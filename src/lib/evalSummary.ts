// Summaries for the answer quality test (step 3e): per model, from the saved answers.
export type EvalGrade = { pointsCovered: number; pointsTotal: number; pushbackOk: boolean | null; note: string };

export type EvalAnswerRow = {
  caseId: string;
  caseKind: "question" | "pushback";
  model: string;
  rating: "approved" | "needs_fix" | null;
  removedAuthorities: number | null;
  firstTextMs: number | null;
  costUsd: number | null;
  error: string | null;
  grade: EvalGrade | null;
};

export type ModelSummary = {
  model: string;
  answers: number;
  failed: number;
  approved: number;
  needsFix: number;
  unrated: number;
  // Exit check: at least 85% of answers approved by the reviewer.
  approvedShare: number | null;
  // Exit check: zero made-up authorities (the citation check had to remove none).
  removedAuthorities: number;
  // Exit check: every pushback case handled correctly (automatic grader; reviewer confirms).
  pushbackPassed: number;
  pushbackTotal: number;
  pointsCoveredShare: number | null;
  // Exit check: first words within 3 seconds (median).
  medianFirstTextMs: number | null;
  averageCostUsd: number | null;
};

export function summariseByModel(rows: EvalAnswerRow[], models: string[]): ModelSummary[] {
  return models.map((model) => {
    const mine = rows.filter((row) => row.model === model);
    const done = mine.filter((row) => !row.error);
    const approved = done.filter((row) => row.rating === "approved").length;
    const needsFix = done.filter((row) => row.rating === "needs_fix").length;
    const rated = approved + needsFix;
    const pushback = done.filter((row) => row.caseKind === "pushback");
    const graded = done.filter((row) => row.grade && row.grade.pointsTotal > 0);
    const covered = graded.reduce((sum, row) => sum + (row.grade?.pointsCovered ?? 0), 0);
    const total = graded.reduce((sum, row) => sum + (row.grade?.pointsTotal ?? 0), 0);
    const costs = done.map((row) => row.costUsd).filter((c): c is number => c !== null);
    return {
      model,
      answers: mine.length,
      failed: mine.length - done.length,
      approved,
      needsFix,
      unrated: done.length - rated,
      approvedShare: rated > 0 ? approved / rated : null,
      removedAuthorities: done.reduce((sum, row) => sum + (row.removedAuthorities ?? 0), 0),
      pushbackPassed: pushback.filter((row) => row.grade?.pushbackOk === true).length,
      pushbackTotal: pushback.length,
      pointsCoveredShare: total > 0 ? covered / total : null,
      medianFirstTextMs: median(done.map((row) => row.firstTextMs).filter((ms): ms is number => ms !== null)),
      averageCostUsd: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
    };
  });
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// The reviewer sees each case's answers as "Answer A, B, C" in an order that differs per case,
// so knowing which model wrote an answer cannot sway the rating. The order is fixed for a case.
export function blindOrder<T extends { model: string }>(caseId: string, answers: T[]): T[] {
  return [...answers].sort((a, b) => hash(`${caseId}:${a.model}`) - hash(`${caseId}:${b.model}`) || (a.model < b.model ? -1 : 1));
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Reads the grader's JSON safely (it is stored as JSON in the database).
export function parseGrade(value: unknown): EvalGrade | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.pointsCovered !== "number" || typeof v.pointsTotal !== "number") return null;
  return {
    pointsCovered: v.pointsCovered,
    pointsTotal: v.pointsTotal,
    pushbackOk: typeof v.pushbackOk === "boolean" ? v.pushbackOk : null,
    note: typeof v.note === "string" ? v.note.slice(0, 500) : "",
  };
}
