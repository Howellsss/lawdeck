import "server-only";
import { parseGrade, type EvalAnswerRow, type EvalGrade } from "@/lib/evalSummary";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Reads for the answer quality test page (step 3e). Callers check the role first; row-level
// security also limits these to reviewers and admins.

export type EvalRunSummary = {
  id: string;
  promptVersion: string;
  models: string[];
  caseCount: number;
  status: "running" | "done" | "failed";
  startedAt: string;
};

export type EvalAnswer = EvalAnswerRow & {
  id: string;
  pushbackType: string | null;
  topic: string | null;
  level: string | null;
  turns: { role: "user" | "assistant"; text: string }[];
  question: string;
  mustInclude: string[];
  expect: string | null;
  answer: string | null;
  notEnough: boolean | null;
  sources: { label: number; title: string }[];
  grade: EvalGrade | null;
  reviewNote: string | null;
};

function failed(what: string, code: string | undefined): never {
  console.error("eval read failed", { what, code: code ?? "unknown" });
  throw new Error("Could not load the answer tests.");
}

export async function listEvalRuns(): Promise<EvalRunSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("eval_runs")
    .select("id, prompt_version, models, case_count, status, started_at")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) failed("runs", error.code);
  return data.map((r) => ({
    id: r.id,
    promptVersion: r.prompt_version,
    models: r.models,
    caseCount: r.case_count,
    status: r.status,
    startedAt: r.started_at,
  }));
}

export async function getEvalRun(id: string): Promise<{ run: EvalRunSummary; answers: EvalAnswer[] } | null> {
  const supabase = await createSupabaseServerClient();
  const [run, answers] = await Promise.all([
    supabase.from("eval_runs").select("id, prompt_version, models, case_count, status, started_at").eq("id", id).maybeSingle(),
    supabase.from("eval_answers").select("*").eq("run_id", id).order("case_id").limit(2000),
  ]);
  if (run.error) failed("run", run.error.code);
  if (answers.error) failed("answers", answers.error.code);
  if (!run.data) return null;
  const r = run.data;
  return {
    run: { id: r.id, promptVersion: r.prompt_version, models: r.models, caseCount: r.case_count, status: r.status, startedAt: r.started_at },
    answers: answers.data.map((a) => ({
      id: a.id,
      caseId: a.case_id,
      caseKind: a.case_kind,
      pushbackType: a.pushback_type,
      topic: a.topic,
      level: a.level,
      turns: Array.isArray(a.turns) ? (a.turns as EvalAnswer["turns"]) : [],
      question: a.question,
      mustInclude: Array.isArray(a.must_include) ? (a.must_include as string[]) : [],
      expect: a.expect,
      model: a.model,
      answer: a.answer,
      notEnough: a.not_enough,
      removedAuthorities: a.removed_authorities,
      sources: Array.isArray(a.sources) ? (a.sources as EvalAnswer["sources"]) : [],
      grade: parseGrade(a.grade),
      firstTextMs: a.first_text_ms,
      costUsd: a.cost_usd === null ? null : Number(a.cost_usd),
      error: a.error,
      rating: a.rating,
      reviewNote: a.review_note,
    })),
  };
}
