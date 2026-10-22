// ADMIN JOB: the answer quality test (Phase 3, step 3e). Uses the service key, the Claude key
// and the Voyage key. Puts every test case through the real answer pipeline on each model,
// grades each answer automatically, and saves everything to eval_runs / eval_answers for the
// legal reviewer (/admin/eval). The repository is public, so this job prints counts and costs
// only: never questions, answers or library text.
//
// Settings (environment): EVAL_MODELS (comma-separated, default all three), EVAL_CASES
// (comma-separated case ids, default all; use a few for a cheap trial run).
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { EXPLAIN_PROMPT_VERSION } from "@/prompts/explain";
import { evalCasesSchema } from "@/schemas/evalCases";
import { gradeAnswer } from "@/server/ai/grade";
import { EXPLAIN_MODELS, type ExplainModel } from "@/server/ai/models";
import { createAdminClient } from "@/server/db/admin";
import { composeAnswer } from "@/server/learn/ask";
import { redactPersonalData } from "@/server/learn/redact";
import { searchLibrary } from "@/server/retrieval/search";

const FILE = "tests/eval/explain/civil-litigation.json";
const CONCURRENCY = 2;
const BUSY_RETRIES = 4;

type Case = {
  id: string;
  kind: "question" | "pushback";
  pushbackType: "wrong_statement" | "holds_position" | "fake_authority" | "valid_correction" | null;
  topic: string | null;
  level: "simple" | "exam";
  turns: { role: "user" | "assistant"; text: string }[];
  question: string;
  mustInclude: string[];
  expect: string | null;
};

function loadCases(): { course: string; cases: Case[] } {
  const file = evalCasesSchema.parse(JSON.parse(readFileSync(FILE, "utf8")));
  const cases: Case[] = [
    ...file.questions.map((q) => ({
      id: q.id,
      kind: "question" as const,
      pushbackType: null,
      topic: q.topic,
      level: q.level,
      turns: [],
      question: q.question,
      mustInclude: q.mustInclude,
      expect: null,
    })),
    ...file.pushback.map((p) => ({
      id: p.id,
      kind: "pushback" as const,
      pushbackType: p.type,
      topic: null,
      level: "exam" as const,
      turns: p.turns.slice(0, -1),
      question: p.turns.at(-1)?.text ?? "",
      mustInclude: p.mustInclude,
      expect: p.expect,
    })),
  ];
  const only = (process.env.EVAL_CASES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return { course: file.course, cases: only.length ? cases.filter((c) => only.includes(c.id)) : cases };
}

function chosenModels(): ExplainModel[] {
  const asked = (process.env.EVAL_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const models = asked.length ? EXPLAIN_MODELS.filter((m) => asked.includes(m)) : [...EXPLAIN_MODELS];
  if (models.length === 0) throw new Error(`EVAL_MODELS must name some of: ${EXPLAIN_MODELS.join(", ")}`);
  return models;
}

// Runs tasks a few at a time, so rate limits are respected.
async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it("runs the answer quality test and saves it for the legal reviewer", { timeout: 110 * 60_000 }, async () => {
  const db = createAdminClient();
  if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY (a workspace key).");
  const { course: slug, cases } = loadCases();
  const models = chosenModels();
  const course = await db.from("courses").select("id").eq("slug", slug).single();
  if (course.error) throw new Error(`Course not found: ${slug}`);

  const run = await db
    .from("eval_runs")
    .insert({ prompt_version: EXPLAIN_PROMPT_VERSION, models, case_count: cases.length })
    .select("id")
    .single();
  if (run.error) throw new Error(`Could not start the run (${run.error.code}). Is migration 15 applied?`);

  const tally = { answered: 0, failed: 0, removedAuthorities: 0, costUsd: 0 };
  const jobs = cases.flatMap((c) => models.map((model) => ({ c, model })));
  await pool(jobs, CONCURRENCY, async ({ c, model }) => {
    const started = Date.now();
    const question = redactPersonalData(c.question);
    let error: string | null = null;
    let composed: Awaited<ReturnType<typeof composeAnswer>> | null = null;
    const found = await searchLibrary({ question, courseId: course.data.id, includePending: false, db });
    if (!found.ok) error = `search failed: ${found.message}`;
    else if (found.hits.length === 0) error = "the library search found nothing";
    else {
      for (let attempt = 0; attempt <= BUSY_RETRIES; attempt++) {
        composed = await composeAnswer({
          db,
          hits: found.hits,
          question,
          level: c.level,
          history: c.turns.map((t) => ({ role: t.role, text: t.role === "user" ? redactPersonalData(t.text) : t.text })),
          courseId: course.data.id,
          userId: "answer-test",
          onText: () => {},
          model,
        });
        if (composed.ok || composed.reason !== "busy") break;
        await sleep(30_000 * (attempt + 1));
      }
      if (composed && !composed.ok) error = `no answer: ${composed.reason}`;
    }

    const ok = composed?.ok ? composed : null;
    const graded = ok
      ? await gradeAnswer({ turns: [...c.turns, { role: "user", text: c.question }], answer: ok.shown, mustInclude: c.mustInclude, expect: c.expect })
      : null;
    const saved = await db.from("eval_answers").insert({
      run_id: run.data.id,
      case_id: c.id,
      case_kind: c.kind,
      pushback_type: c.pushbackType,
      topic: c.topic,
      level: c.level,
      turns: c.turns,
      question: c.question,
      must_include: c.mustInclude,
      expect: c.expect,
      model,
      answer: ok?.shown ?? null,
      raw_answer: ok?.raw ?? null,
      not_enough: ok?.notEnough ?? null,
      removed_authorities: ok?.removedAuthorities ?? null,
      sources: ok ? ok.used.map((hit) => ({ label: hit.label, title: hit.itemTitle })) : [],
      grade: graded?.ok ? graded.grade : null,
      first_text_ms: ok?.result.firstTextMs ?? null,
      total_ms: Date.now() - started,
      tokens_in: ok?.result.tokensIn ?? null,
      tokens_out: ok?.result.tokensOut ?? null,
      cost_usd: ok?.result.costUsd ?? null,
      error,
    });
    if (saved.error) throw new Error(`Could not save ${c.id} on ${model} (${saved.error.code})`);
    if (ok) {
      tally.answered++;
      tally.removedAuthorities += ok.removedAuthorities;
      tally.costUsd += (ok.result.costUsd ?? 0) + (graded?.ok ? (graded.costUsd ?? 0) : 0);
    } else tally.failed++;
    // Progress: ids and counts only (the repository and its logs are public).
    console.info(`answer test: ${c.id} on ${model}: ${ok ? "answered" : "failed"} (${tally.answered + tally.failed}/${jobs.length})`);
  });

  await db.from("eval_runs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", run.data.id);
  console.info(
    `answer test finished: ${tally.answered} answered, ${tally.failed} failed, ${tally.removedAuthorities} made-up authorities removed, about $${tally.costUsd.toFixed(2)}. Rate the answers on /admin/eval.`,
  );
  expect(tally.answered).toBeGreaterThan(0);
});
