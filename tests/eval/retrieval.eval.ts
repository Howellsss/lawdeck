// ADMIN JOB: the retrieval test uses the service-role key (read-only here) and the Voyage key.
// See tests/eval/retrieval/README.md.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAdminClient } from "@/server/db/admin";
import { fuseRankings, rankByMeaning } from "@/server/retrieval/fuse";
import { passageSearchText } from "@/server/retrieval/indexJob";
import { EMBEDDING_MODELS, type EmbeddingModel } from "@/server/retrieval/settings";
import { batchByTokens, embedWithRetry } from "@/server/retrieval/voyage";

const TOP = 5;
const TARGET = 25;
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
      }),
    )
    .min(1),
});

type Passage = { id: string; itemTitle: string; heading: string | null; text: string };

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

async function embedAll(texts: string[], inputType: "document" | "query", model: EmbeddingModel) {
  const vectors: number[][] = [];
  for (const batch of batchByTokens(texts)) {
    // Waits out Voyage's per-minute limits for up to five minutes per batch.
    const result = await embedWithRetry(batch, inputType, model, "eval", Date.now() + 5 * 60_000);
    if (!result.ok) throw new Error(`Voyage (${model}) failed: ${result.reason}`);
    vectors.push(...result.vectors);
  }
  return vectors;
}

describe("retrieval test", () => {
  it(`finds the right passage in the top ${TOP} for at least ${TARGET} of 30 questions`, async () => {
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
        .select("id, item_id, heading, text")
        .in("item_id", [...titles.keys()])
        .order("id")
        .range(from, from + 999);
      if (page.error) throw new Error(`Passages could not be loaded (${page.error.code})`);
      passages.push(...page.data.map((p) => ({ id: p.id, itemTitle: titles.get(p.item_id) ?? "", heading: p.heading, text: p.text })));
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

    const isHit = (q: (typeof questions)[number], ids: string[]) =>
      ids.some((id) => {
        const p = byId.get(id);
        return (
          p !== undefined &&
          normalise(passageSearchText(p.heading, p.text)).includes(normalise(q.expectContains)) &&
          (!q.itemTitle || normalise(p.itemTitle) === normalise(q.itemTitle))
        );
      });

    const lines = [`Retrieval test: ${questions.length} questions, ${passages.length} passages, top ${TOP}`, ""];
    const scores: Record<string, number> = {};
    const wordsOnly = questions.filter((q) => isHit(q, (byWords.get(String(q.id)) ?? []).slice(0, TOP))).length;
    for (const model of Object.keys(EMBEDDING_MODELS) as EmbeddingModel[]) {
      const docVectors = await embedAll(passages.map((p) => passageSearchText(p.heading, p.text)), "document", model);
      const queryVectors = await embedAll(questions.map((q) => q.question), "query", model);
      const indexed = passages.map((p, i) => ({ id: p.id, vector: docVectors[i] }));
      let hybrid = 0;
      let meaningOnly = 0;
      const misses: string[] = [];
      questions.forEach((q, i) => {
        const meaning = rankByMeaning(queryVectors[i], indexed);
        if (isHit(q, meaning.slice(0, TOP))) meaningOnly++;
        if (isHit(q, fuseRankings(meaning, byWords.get(String(q.id)) ?? [], TOP))) hybrid++;
        else misses.push(String(q.id));
      });
      scores[model] = hybrid;
      lines.push(
        `${EMBEDDING_MODELS[model].label}: hybrid ${hybrid}/${questions.length}, meaning only ${meaningOnly}/${questions.length}; missed: ${misses.join(", ") || "none"}`,
      );
    }
    lines.push(`Exact words only: ${wordsOnly}/${questions.length}`);
    const best = Math.max(...Object.values(scores));
    lines.push("", `Best: ${best}/${questions.length} (target ${TARGET})`);
    console.info(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.map((line) => (line ? `- ${line}` : "")).join("\n") + "\n");
    }
    expect(best).toBeGreaterThanOrEqual(Math.min(TARGET, questions.length));
  });
});
