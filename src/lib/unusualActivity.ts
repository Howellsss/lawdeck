// Limits for the hourly unusual-access check (step 7e, rule P-03; founder, 2026-10-23). Starting
// guesses, to be tuned after the pilot's first weeks. Counts are for the last hour.
export const UNUSUAL_LIMITS: Record<string, { limit: number; label: string }> = {
  failed_sign_ins: { limit: 50, label: "failed sign-ins in total" },
  emails_with_5_failed_sign_ins: { limit: 5, label: "accounts paused after 5 wrong passwords" },
  sign_ups: { limit: 100, label: "sign-ups" },
  most_downloads_by_one_account: { limit: 30, label: "downloads by a single account" },
  most_questions_by_one_account: { limit: 60, label: "questions by a single account" },
};

// The counts that went over their limit, in plain words (counts only, never who).
export function overLimits(counts: { metric: string; value: number }[]): string[] {
  return counts
    .filter((row) => UNUSUAL_LIMITS[row.metric] && row.value > UNUSUAL_LIMITS[row.metric].limit)
    .map((row) => `${row.value} ${UNUSUAL_LIMITS[row.metric].label} in the last hour (limit ${UNUSUAL_LIMITS[row.metric].limit})`);
}
