import "server-only";
import { placeMarks } from "@/lib/lessonMarks";
import type { LessonContent, LessonReply, LessonSource } from "@/schemas/lesson";
import { checkWithLibrary, REMOVED_AUTHORITY, type FilterContext } from "@/server/learn/answerFilter";
import type { Database } from "@/server/db/types";

type CheckpointRow = Omit<Database["public"]["Tables"]["lesson_checkpoints"]["Insert"], "lesson_id">;
type AuthorityRow = Omit<Database["public"]["Tables"]["lesson_authorities"]["Insert"], "lesson_id">;

export type CleanLesson = {
  title: string;
  content: Omit<LessonContent, "sources">;
  usedLabels: number[];
  checkpoints: CheckpointRow[];
  authorities: AuthorityRow[];
  // How many authorities or questions were dropped because the library could not confirm them.
  removed: number;
};

// Checks every part of a lesson before it is saved (rules G-04, G-05; docs/specs/remembrance.md):
// the citation check runs on every paragraph, authority card and question; an authority the
// library cannot confirm is dropped, and so is any question whose answer named one; highlights
// are placed on the checked text, within the calm limits; facts not given by the library are
// left out of an authority card.
export async function cleanLesson(reply: LessonReply, context: FilterContext): Promise<CleanLesson> {
  const check = (text: string) => (text ? checkWithLibrary(text, context) : Promise.resolve(""));
  const validLabels = (labels: number[]) => [...new Set(labels.filter((label) => context.labels.has(label)))];
  let removed = 0;

  const authorities: AuthorityRow[] = [];
  for (const authority of reply.authorities) {
    const name = await check(authority.name);
    if (name.includes(REMOVED_AUTHORITY) || authorities.some((a) => a.key === authority.key)) {
      removed += 1;
      continue;
    }
    const [principle, issue, decision, facts] = await Promise.all([
      check(authority.principle),
      check(authority.issue),
      check(authority.decision),
      authority.facts_from_library ? check(authority.facts) : Promise.resolve(""),
    ]);
    authorities.push({
      key: authority.key,
      kind: authority.kind,
      name,
      principle,
      citation: authority.citation || null,
      court: authority.court || null,
      issue: issue || null,
      decision: decision || null,
      facts: facts || null,
      facts_from_library: authority.facts_from_library && Boolean(facts),
      sources: validLabels(authority.sources),
    });
  }
  const keys = new Set(authorities.map((a) => a.key));

  const sections: LessonContent["sections"] = [];
  for (const section of reply.sections) {
    const paragraphs = [];
    for (const paragraph of section.paragraphs) {
      const text = await check(paragraph.text);
      paragraphs.push({ text, sources: validLabels(paragraph.sources), marks: placeMarks(text, paragraph.marks, keys) });
    }
    sections.push({ heading: section.heading, paragraphs });
  }

  const last = Math.max(0, sections.length - 1);
  const checkpoints: CheckpointRow[] = [];
  for (const checkpoint of reply.checkpoints) {
    const [prompt, answer, explanation, ...choices] = await Promise.all([
      check(checkpoint.prompt),
      check(checkpoint.answer),
      check(checkpoint.explanation),
      ...checkpoint.choices.map(check),
    ]);
    const mcq = checkpoint.kind === "mcq";
    const mcqOk = choices.length >= 2 && checkpoint.correct_choice >= 0 && checkpoint.correct_choice < choices.length;
    const named = [prompt, answer, explanation, ...choices].some((text) => text.includes(REMOVED_AUTHORITY));
    if (named || (mcq && !mcqOk)) {
      removed += 1;
      continue;
    }
    checkpoints.push({
      position: 0,
      after_section: checkpoint.placement === "test" ? last : Math.min(checkpoint.after_section, last),
      placement: checkpoint.placement,
      kind: checkpoint.kind,
      prompt,
      answer,
      explanation: explanation || null,
      choices: mcq ? choices.slice(0, 6) : null,
      correct_choice: mcq ? checkpoint.correct_choice : null,
      key_point: checkpoint.key_point,
      sources: validLabels(checkpoint.sources),
    });
  }
  // Reading questions in the order they come up, then the end-of-topic test.
  checkpoints.sort((a, b) => Number(a.placement === "test") - Number(b.placement === "test") || a.after_section - b.after_section);
  checkpoints.splice(200);
  checkpoints.forEach((checkpoint, index) => (checkpoint.position = index));

  const used = new Set<number>();
  for (const section of sections) for (const paragraph of section.paragraphs) paragraph.sources.forEach((l) => used.add(l));
  for (const row of [...authorities, ...checkpoints]) for (const l of (row.sources as number[] | undefined) ?? []) used.add(l);

  return { title: reply.title || "", content: { sections }, usedLabels: [...used].sort((a, b) => a - b), checkpoints, authorities, removed };
}

// The passages a lesson rests on, by label: title, heading, pages and passage id, never the text.
export function lessonSources(
  labels: number[],
  hits: { label: number; passageId: string; itemTitle: string; heading: string | null; pages: string | null }[],
): LessonSource[] {
  return labels
    .map((label) => hits.find((hit) => hit.label === label))
    .filter((hit) => hit !== undefined)
    .map((hit) => ({ label: hit.label, passageId: hit.passageId, title: hit.itemTitle.slice(0, 300), heading: hit.heading?.slice(0, 500) ?? null, pages: hit.pages }));
}
