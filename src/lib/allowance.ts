// The monthly question allowance, worked out from what the database returns (migration 14).
// `window` is the optional short-term limit for a public test, for example 5 questions every
// 3 hours (migration 35); `resetsAt` is set only while it is used up.
export type AllowanceWindow = { used: number; limit: number; resetsAt: string | null };
export type Allowance = { used: number; limit: number; unlimited: boolean; window?: AllowanceWindow | null };

function monthlyLeft(a: Allowance): number {
  return Math.max(a.limit - a.used, 0);
}

function windowLeft(a: Allowance): number | null {
  return a.window ? Math.max(a.window.limit - a.window.used, 0) : null;
}

export function questionsLeft(a: Allowance): number | null {
  if (a.unlimited) return null;
  const inWindow = windowLeft(a);
  return inWindow === null ? monthlyLeft(a) : Math.min(monthlyLeft(a), inWindow);
}

// A time later today or tomorrow in Lagos, e.g. "4:40 pm" or "tomorrow at 1:05 am".
export function lagosTime(at: string | Date, now: Date = new Date()): string {
  const when = new Date(at);
  const time = when
    .toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s+/g, " ")
    .toLowerCase();
  const day = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" });
  return day(when) === day(now) ? time : `tomorrow at ${time}`;
}

// The first day of next month in Lagos, e.g. "1 November".
export function resetDay(now: Date = new Date()): string {
  const lagos = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const next = new Date(lagos.getFullYear(), lagos.getMonth() + 1, 1);
  return `1 ${next.toLocaleString("en-GB", { month: "long" })}`;
}

// The closed pilot (Phase 8): while invite-only is on, students without an invite code have 0 questions.
export const CLOSED_PILOT_MESSAGE =
  "Lawdeck is open to invited testers for now. If you have an invite code, enter it on your Account page; otherwise the Lawdeck team will give you access soon.";

export function limitReachedMessage(a: Allowance, now: Date = new Date()): string {
  if (a.limit === 0) return CLOSED_PILOT_MESSAGE;
  if (monthlyLeft(a) === 0 || !a.window)
    return `You’ve used all ${a.limit} questions for this month. You can ask again from ${resetDay(now)}.`;
  const when = a.window.resetsAt ? lagosTime(a.window.resetsAt, now) : null;
  const again = !when ? "Please try again later." : `You can ask again ${when.startsWith("tomorrow") ? when : `at ${when}`}.`;
  return `You’ve used your ${a.window.limit} question${a.window.limit === 1 ? "" : "s"} for now. ${again}`;
}

// The note under the question box, e.g. "12 of 30 questions left this month", or with a short-term
// limit "3 of 5 questions left for now · 18 of 25 this month".
export function allowanceNote(a: Allowance): string | null {
  if (a.unlimited) return null;
  const month = `${monthlyLeft(a)} of ${a.limit} question${a.limit === 1 ? "" : "s"} left this month`;
  const inWindow = windowLeft(a);
  if (inWindow === null || !a.window) return month;
  return `${inWindow} of ${a.window.limit} left for now · ${monthlyLeft(a)} of ${a.limit} this month`;
}
