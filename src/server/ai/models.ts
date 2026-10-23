import "server-only";

// Which Claude model does which job. Change a job's model here, in one place (rule G-01).
// Phase 3 tests which model each Learn and Practice job really needs.
export const MODELS = {
  healthCheck: "claude-haiku-5-5",
  // Auto mode: Learn or Draft (step 3c).
  routing: "claude-haiku-5-5",
  smallJobs: "claude-haiku-5-5",
  // Reading scanned pages and photos into text (step 2c). Switch to Sonnet if a sample scan shows mistakes.
  transcribe: "claude-haiku-5-5",
  explain: "claude-sonnet-5-5",
  // Practice questions (step 4b): the model chosen for explanations in step 3e.
  practice: "claude-sonnet-5-5",
  // Case and statute briefs (step 4f): legal judgement, so the explanations model.
  brief: "claude-sonnet-5-5",
  // Flashcards (step 4c): short facts from the notes; System Design §5.3 names Haiku for them.
  flashcards: "claude-haiku-5-5",
  // Mark my answer (step 4e): Opus, as CLAUDE.md sets for marking (founder, 2026-10-22).
  marking: "claude-opus-5-5",
  documents: "claude-opus-5-5",
} as const;

export type AiJob = keyof typeof MODELS;

// The models step 3e compares for explanations, with the lowest-thinking setting each accepts,
// so the first words appear quickly (budget L-02: 3 seconds). Each model takes a different
// setting: Sonnet 5.5 rejects "disabled" thinking, and Opus 5.5 cannot turn thinking off at all.
export const EXPLAIN_MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"] as const;
export type ExplainModel = (typeof EXPLAIN_MODELS)[number];

export const EXPLAIN_SETTINGS: Record<
  ExplainModel,
  { thinking?: { type: "disabled" } | { type: "between_tools" }; effort?: "low" | "medium" | "high" }
> = {
  "claude-haiku-5-5": { thinking: { type: "disabled" } },
  "claude-sonnet-5-5": { thinking: { type: "between_tools" } },
  "claude-opus-5-5": { effort: "low" },
};
