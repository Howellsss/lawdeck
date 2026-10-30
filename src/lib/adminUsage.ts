// Plain names for the kinds of AI use Lawdeck records (usage_events.kind), for the admin usage
// pages (founder, 2026-10-30). Unknown kinds are shown as they are stored.
export const USAGE_KIND_LABELS: Record<string, string> = {
  explain: "Answers (questions and problem questions)",
  talk_chat: "Voice-mode small talk",
  speech: "Voice (read aloud and voice replies)",
  practice: "MCQ sets",
  brief: "Case and statute briefs",
  marking: "Marked answers",
  draft: "Drafted documents",
  draft_pick: "Choosing a template",
  route: "Understanding requests",
  transcribe: "Reading scanned notes",
};

export function usageKindLabel(kind: string): string {
  return USAGE_KIND_LABELS[kind] ?? kind;
}

// Dollars to show: cents for small amounts, whole dollars with separators for large ones.
export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ₦ at the rate used in Lawdeck's cost documents (founder's funding breakdown, 2026-10-23).
export const NAIRA_PER_USD = 1400;

export function formatNaira(usd: number): string {
  return `₦${Math.round(usd * NAIRA_PER_USD).toLocaleString("en-NG")}`;
}
