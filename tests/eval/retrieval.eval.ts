// ADMIN JOB: the retrieval test uses the service-role key (read-only here) and the Voyage key.
// See tests/eval/retrieval/README.md.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAdminClient } from "@/server/db/admin";
import { fuseRankings, rankByMeaning } from "@/server/retrieval/fuse";
import { passageSearchText } from "@/server/retrieval/indexJob";
import { EMBEDDING_MODELS, type EmbeddingModel } from "@/server/retrieval/settings";
import { EMBED_BATCH, embedTexts, fitTokenBudget } from "@/server/retrieval/voyage";

const TOP = 5;
// Build Phases target: 25 of 30 in the top 5, i.e. five in six, whatever the number of questions.
const targetFor = (count: number) => Math.ceil((count * 25) / 30);
// Weights for the exact-words ranking to compare (1 = the live setting, see fuse.ts).
const WORDS_WEIGHTS = [1, 0.5, 0.25, 0];
const FILE = process.env.EVAL_QUESTIONS ?? "tests/eval/retrieval/civil-litigation.json";

const questionsSchema = z.object({
  course: z.string().min(1),
  questions: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]),
        question: z.string().min(3).max(1000),
        expectContains: z.string().min(5),
        itemTitle: z.string().optional(),
        // "exact": the question uses an exact term from the notes (a rule number, a form).
        kind: z.enum(["meaning", "exact"]).optional(),
      }),
    )
    .min(1),
});

type Passage = { id: string; itemId: string; position: number; itemTitle: string; heading: string | null; text: string };

// The real search hands the top 8 passages to the AI (SEARCH_RESULTS); the target is set on the top 5.
const AI_RECEIVES = 8;

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

// Same pacing as the indexing job: batches that fit Voyage's per-minute limit, and when Voyage
// asks us to slow down, wait and try again (a few times) instead of failing the run.
async function embedAll(texts: string[], inputType: "document" | "query", model: EmbeddingModel) {
  const vectors: number[][] = [];
  let busyInARow = 0;
  for (let i = 0; i < texts.length; ) {
    const window = texts.slice(i, i + EMBED_BATCH);
    const batch = window.slice(0, fitTokenBudget(window));
    const result = await embedTexts(batch, inputType, model, "eval");
    if (!result.ok && result.reason === "busy" && busyInARow < 10) {
      busyInARow++;
      await new Promise((resolve) => setTimeout(resolve, result.retryAfterMs ?? 20_000));
      continue;
    }
    if (!result.ok) throw new Error(`Voyage (${model}) failed: ${result.reason}`);
    busyInARow = 0;
    vectors.push(...result.vectors);
    i += batch.length;
  }
  return vectors;
}

describe("retrieval test", () => {
  it(`finds the right passage in the top ${TOP} for at least five in six questions`, async () => {
    if (!existsSync(FILE)) throw new Error(`Questions file not found: ${FILE}. See tests/eval/retrieval/README.md.`);
    const { course: slug, questions } = questionsSchema.parse(JSON.parse(readFileSync(FILE, "utf8")));
    const db = createAdminClient();
    if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.");

    const course = await db.from("courses").select("id").eq("slug", slug).single();
    if (course.error) throw new Error(`Course not found: ${slug}`);
    const items = await db
      .from("kb_items")
      .select("id, title")
      .eq("course_id", course.data.id)
      .in("review_status", ["approved", "pending"]);
    if (items.error) throw new Error(`Items could not be loaded (${items.error.code})`);
    const titles = new Map(items.data.map((item) => [item.id, item.title]));

    const passages: Passage[] = [];
    for (let from = 0; ; from += 1000) {
      const page = await db
        .from("kb_passages")
        .select("id, item_id, position, heading, text")
        .in("item_id", [...titles.keys()])
        .order("id")
        .range(from, from + 999);
      if (page.error) throw new Error(`Passages could not be loaded (${page.error.code})`);
      passages.push(
        ...page.data.map((p) => ({
          id: p.id,
          itemId: p.item_id,
          position: p.position,
          itemTitle: titles.get(p.item_id) ?? "",
          heading: p.heading,
          text: p.text,
        })),
      );
      if (page.data.length < 1000) break;
    }
    expect(passages.length, "The course has no passages to search").toBeGreaterThan(0);
    const byId = new Map(passages.map((p) => [p.id, p]));

    // Ranking by exact words is the same for every model: ask the database once per question.
    const byWords = new Map<string, string[]>();
    for (const q of questions) {
      const { data, error } = await db.rpc("search_library", {
        query_text: q.question,
        course: course.data.id,
        include_pending: true,
      });
      if (error) throw new Error(`search_library failed (${error.code})`);
      byWords.set(String(q.id), data.map((row) => row.passage_id));
    }

    const answers = (q: (typeof questions)[number], p: Passage | undefined) =>
      p !== undefined &&
      normalise(passageSearchText(p.heading, p.text)).includes(normalise(q.expectContains)) &&
      (!q.itemTitle || normalise(p.itemTitle) === normalise(q.itemTitle));
    const isHit = (q: (typeof questions)[number], ids: string[]) => ids.some((id) => answers(q, byId.get(id)));
    // Place (1 = first) of the first passage that answers the question, or "-" when not ranked.
    const placeOf = (q: (typeof questions)[number], ids: string[]) => {
      const index = ids.findIndex((id) => answers(q, byId.get(id)));
      return index < 0 ? "-" : String(index + 1);
    };
    // Why a miss might be the test's fault: how many passages contain the answer phrase, and
    // whether it only appears when neighbouring passages are joined (split across a boundary).
    const phraseCheck = (q: (typeof questions)[number]) => {
      const inPassages = passages.filter((p) => answers(q, p)).length;
      if (inPassages > 0) return `answer phrase in ${inPassages} passage(s)`;
      const items = new Map<string, Passage[]>();
      passages.forEach((p) => items.set(p.itemId, [...(items.get(p.itemId) ?? []), p]));
      const split = [...items.values()].some((list) =>
        normalise(list.sort((a, b) => a.position - b.position).map((p) => p.text).join(" ")).includes(normalise(q.expectContains)),
      );
      return split ? "answer phrase split across two passages" : "answer phrase not found in the library text";
    };

    const lines = [`Retrieval test: ${questions.length} questions, ${passages.length} passages, top ${TOP}`, ""];
    const scores: Record<string, number> = {};
    const wordsOnly = questions.filter((q) => isHit(q, (byWords.get(String(q.id)) ?? []).slice(0, TOP))).length;
    for (const model of Object.keys(EMBEDDING_MODELS) as EmbeddingModel[]) {
      const docVectors = await embedAll(passages.map((p) => passageSearchText(p.heading, p.text)), "document", model);
      const queryVectors = await embedAll(questions.map((q) => q.question), "query", model);
      const indexed = passages.map((p, i) => ({ id: p.id, vector: docVectors[i] }));
      let hybrid = 0;
      let hybridAi = 0;
      let meaningOnly = 0;
      const misses: string[] = [];
      const details: string[] = [];
      questions.forEach((q, i) => {
        const meaning = rankByMeaning(queryVectors[i], indexed);
        const words = byWords.get(String(q.id)) ?? [];
        const combined = fuseRankings(meaning, words, passages.length);
        if (isHit(q, meaning.slice(0, TOP))) meaningOnly++;
        if (isHit(q, combined.slice(0, AI_RECEIVES))) hybridAi++;
        if (isHit(q, combined.slice(0, TOP))) hybrid++;
        else {
          misses.push(String(q.id));
          details.push(
            `  Q${q.id}: right passage at combined #${placeOf(q, combined)}, meaning #${placeOf(q, meaning)}, words #${placeOf(q, words)}; ${phraseCheck(q)}`,
          );
        }
      });
      scores[model] = hybrid;
      lines.push(
        `${EMBEDDING_MODELS[model].label}: hybrid ${hybrid}/${questions.length} (top ${AI_RECEIVES}: ${hybridAi}/${questions.length}), meaning only ${meaningOnly}/${questions.length}; missed: ${misses.join(", ") || "none"}`,
        ...details,
      );
      // Same model, different trust in exact words: top 5 and top 8, overall and for exact-term questions.
      const exact = questions.filter((q) => q.kind === "exact");
      for (const weight of WORDS_WEIGHTS) {
        const counts = { top: 0, ai: 0, exactTop: 0, exactAi: 0 };
        questions.forEach((q, i) => {
          const combined = fuseRankings(rankByMeaning(queryVectors[i], indexed), byWords.get(String(q.id)) ?? [], AI_RECEIVES, weight);
          const top = isHit(q, combined.slice(0, TOP));
          const ai = isHit(q, combined);
          counts.top += Number(top);
          counts.ai += Number(ai);
          if (q.kind === "exact") {
            counts.exactTop += Number(top);
            counts.exactAi += Number(ai);
          }
        });
        lines.push(
          `  words weight ${weight}: top ${TOP} ${counts.top}/${questions.length}, top ${AI_RECEIVES} ${counts.ai}/${questions.length}; exact-term questions top ${TOP} ${counts.exactTop}/${exact.length}, top ${AI_RECEIVES} ${counts.exactAi}/${exact.length}`,
        );
      }
    }
    lines.push(`Exact words only: ${wordsOnly}/${questions.length}`);
    const best = Math.max(...Object.values(scores));
    lines.push("", `Best (live setting): ${best}/${questions.length} (target ${targetFor(questions.length)})`);
    console.info(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.map((line) => (line ? `- ${line}` : "")).join("\n") + "\n");
    }
    expect(best).toBeGreaterThanOrEqual(targetFor(questions.length));
  });
});
