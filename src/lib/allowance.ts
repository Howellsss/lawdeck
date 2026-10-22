// The monthly question allowance, worked out from what the database returns (migration 14).
export type Allowance = { used: number; limit: number; unlimited: boolean };

export function questionsLeft(a: Allowance): number | null {
  return a.unlimited ? null : Math.max(a.limit - a.used, 0);
}

// The first day of next month in Lagos, e.g. "1 November".
export function resetDay(now: Date = new Date()): string {
  const lagos = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const next = new Date(lagos.getFullYear(), lagos.getMonth() + 1, 1);
  return `1 ${next.toLocaleString("en-GB", { month: "long" })}`;
}

export function limitReachedMessage(a: Allowance, now: Date = new Date()): string {
  return `You’ve used all ${a.limit} questions for this month. You can ask again from ${resetDay(now)}.`;
}

// The note under the question box, e.g. "12 of 30 questions left this month".
export function allowanceNote(a: Allowance): string | null {
  const left = questionsLeft(a);
  if (left === null) return null;
  return `${left} of ${a.limit} question${a.limit === 1 ? "" : "s"} left this month`;
}
