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
  marking: "claude-sonnet-5-5",
  documents: "claude-opus-5-5",
} as const;

export type AiJob = keyof typeof MODELS;
