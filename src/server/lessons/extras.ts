import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAids, selectStories } from "@/lib/extrasRules";
import { EXTRAS_PROMPT_VERSION } from "@/prompts/extras";
import { lessonContentSchema } from "@/schemas/lesson";
import { writeExtras } from "@/server/ai/extras";
import type { Database } from "@/server/db/types";
import { checkWithLibrary, REMOVED_AUTHORITY } from "@/server/learn/answerFilter";
import { filterContextFor } from "@/server/learn/filterContext";

type Db = SupabaseClient<Database>;

export type GenerateExtrasResult = { ok: true; aids: number; stories: number; removed: number } | { ok: false; message: string };

const FAILURES = {
  no_key: "Memory aids are not switched on yet: the Claude key is missing on the server.",
  busy: "Claude is busy right now. Please try again in a minute.",
  refused: "Claude would not write memory aids for this lesson.",
  unavailable: "Lawdeck could not reach Claude, or it took too long. Please try again.",
  malformed: "The memory aids came back incomplete. Please try again.",
} as const;

// Writes (or rewrites) a lesson's memory aids and stories for review (docs/specs/remembrance.md,
// Phase 2), from the lesson, its authority cards and the same library passages the lesson was
// written from. Runs as the signed-in reviewer; saved as awaiting review. The lesson itself is
// never changed, so its approval stands.
export async function generateExtras(db: Db, topicId: string): Promise<GenerateExtrasResult> {
  const topic = await db.from("topics").select("id, name, course_id").eq("id", topicId).maybeSingle();
  if (topic.error || !topic.data) return { ok: false, message: "That topic could not be found." };
  const lesson = await db.from("topic_lessons").select("id, content").eq("topic_id", topicId).maybeSingle();
  const content = lesson.data ? lessonContentSchema.safeParse(lesson.data.content) : null;
  if (lesson.error || !lesson.data || !content?.success || content.data.sections.length === 0) {
    return { ok: false, message: "Write this topic's lesson first: memory aids are made from it." };
  }
  const lessonId = lesson.data.id;

  const ids = content.data.sources.map((s) => s.passageId);
  const [authorities, passages] = await Promise.all([
    db.from("lesson_authorities").select("key, kind, name, citation, principle, facts_from_library, facts, issue, decision").eq("lesson_id", lessonId),
    ids.length ? db.from("kb_passages").select("id, item_id, heading, text, page_from, page_to").in("id", ids) : Promise.resolve({ data: [], error: null }),
  ]);
  if (authorities.error || passages.error) return saveFailed("read", authorities.error?.code ?? passages.error?.code);
  const hits = content.data.sources.flatMap((source) => {
    const passage = passages.data.find((p) => p.id === source.passageId);
    if (!passage) return [];
    return [
      {
        label: source.label,
        passageId: passage.id,
        itemId: passage.item_id,
        itemTitle: source.title,
        heading: passage.heading,
        text: passage.text,
        pageFrom: passage.page_from,
        pageTo: passage.page_to,
        pages: source.pages,
        score: 1,
        meaningRank: null,
        wordsRank: null,
      },
    ];
  });

  const written = await writeExtras(
    {
      topic: topic.data.name,
      sections: content.data.sections.map((s) => ({ heading: s.heading, paragraphs: s.paragraphs.map((p) => p.text) })),
      authorities: authorities.data.map((a) => ({
        key: a.key,
        kind: a.kind,
        name: a.name,
        citation: a.citation,
        principle: a.principle,
        factsFromLibrary: a.facts_from_library,
        facts: a.facts,
        issue: a.issue,
        decision: a.decision,
      })),
    },
    hits.map((h) => ({ label: h.label, itemTitle: h.itemTitle, heading: h.heading, pages: h.pages, text: h.text })),
  );
  if (!written.ok) return { ok: false, message: FAILURES[written.reason] };
  if (!written.reply.found) return { ok: false, message: "This lesson has nothing that suits a memory aid or story, so none were written." };

  // Lawdeck's own limits first, then the citation check on every piece of text.
  const last = content.data.sections.length - 1;
  const aids = selectAids(written.reply.memory_aids, last);
  const stories = selectStories(
    written.reply.stories,
    last,
    authorities.data.map((a) => ({ key: a.key, factsFromLibrary: a.facts_from_library })),
  );
  let removed = aids.dropped + stories.dropped;
  const context = await filterContextFor(db, hits, topic.data.course_id);
  const check = (text: string) => (text ? checkWithLibrary(text, context) : Promise.resolve(""));
  const labels = (list: number[]) => [...new Set(list.filter((l) => context.labels.has(l)))];

  const aidRows: Database["public"]["Tables"]["lesson_memory_aids"]["Insert"][] = [];
  for (const aid of aids.kept) {
    const [title, device, explanation, ...meanings] = await Promise.all([check(aid.title), check(aid.device), check(aid.explanation), ...aid.items.map((i) => check(i.meaning))]);
    if ([title, device, explanation, ...meanings].some((t) => t.includes(REMOVED_AUTHORITY))) {
      removed += 1;
      continue;
    }
    aidRows.push({
      extras_id: "",
      position: aidRows.length,
      after_section: aid.after_section,
      kind: aid.kind,
      title,
      device,
      items: aid.items.map((item, i) => ({ key: item.key, meaning: meanings[i] ?? item.meaning })),
      explanation: explanation || null,
      sources: labels(aid.sources),
    });
  }
  const storyRows: Database["public"]["Tables"]["lesson_stories"]["Insert"][] = [];
  for (const story of stories.kept) {
    const [title, takeaway, question, explanation, ...rest] = await Promise.all([
      check(story.title),
      check(story.takeaway),
      check(story.question),
      check(story.explanation),
      ...story.parts.map((p) => check(p.text)),
      ...story.choices.map(check),
    ]);
    const parts = rest.slice(0, story.parts.length);
    const choices = rest.slice(story.parts.length);
    if ([title, takeaway, question, explanation, ...rest].some((t) => t.includes(REMOVED_AUTHORITY))) {
      removed += 1;
      continue;
    }
    storyRows.push({
      extras_id: "",
      position: storyRows.length,
      after_section: story.after_section,
      kind: story.kind,
      title,
      authority_key: story.authority || null,
      parts: story.parts.map((p, i) => ({ heading: p.heading, text: parts[i] ?? "" })),
      takeaway,
      question: question || null,
      choices: question ? choices : null,
      correct_choice: question ? story.correct_choice : null,
      explanation: question ? explanation || null : null,
      sources: labels(story.sources),
    });
  }
  if (aidRows.length === 0 && storyRows.length === 0) {
    return { ok: false, message: "No memory aid or story passed Lawdeck's checks for this lesson. You can try again." };
  }

  // One set per lesson: replace any earlier one.
  const gone = await db.from("lesson_extras").delete().eq("lesson_id", lessonId);
  if (gone.error) return saveFailed("clear", gone.error.code);
  const extras = await db
    .from("lesson_extras")
    .insert({ lesson_id: lessonId, model: written.model, prompt_version: EXTRAS_PROMPT_VERSION })
    .select("id")
    .single();
  if (extras.error) return saveFailed("insert", extras.error.code);
  const [savedAids, savedStories] = await Promise.all([
    aidRows.length ? db.from("lesson_memory_aids").insert(aidRows.map((r) => ({ ...r, extras_id: extras.data.id }))) : null,
    storyRows.length ? db.from("lesson_stories").insert(storyRows.map((r) => ({ ...r, extras_id: extras.data.id }))) : null,
  ]);
  if (savedAids?.error || savedStories?.error) return saveFailed("parts", savedAids?.error?.code ?? savedStories?.error?.code);
  return { ok: true, aids: aidRows.length, stories: storyRows.length, removed };
}

function saveFailed(step: string, code: string | undefined): GenerateExtrasResult {
  console.error("memory aids save failed", { step, code: code ?? "unknown" });
  return { ok: false, message: "The memory aids were written but could not be saved. Please try again." };
}
