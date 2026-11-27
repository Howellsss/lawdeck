// The credit allowance, worked out from what the database returns (migrations 14, 35, 68, 74).
// - month: the plan's credits for the paid month (from the day the student paid), the 7-day
//   trial, or the calendar month;
// - window: credits every 3 hours, refilling 3 hours after the first use in the window;
// - week: credits per 7 days, counted from the start of the paid month.
// `resetsAt` is set only while that limit is used up.
export type AllowanceWindow = { used: number; limit: number; resetsAt: string | null };
export type Allowance = {
  used: number;
  limit: number;
  unlimited: boolean;
  window?: AllowanceWindow | null;
  week?: AllowanceWindow | null;
  // When the paid month or the trial ends (migration 74); absent on older data.
  periodEndsAt?: string | null;
  trial?: boolean;
};

function monthlyLeft(a: Allowance): number {
  return Math.max(a.limit - a.used, 0);
}

function left(w: AllowanceWindow | null | undefined): number | null {
  return w ? Math.max(w.limit - w.used, 0) : null;
}

export function questionsLeft(a: Allowance): number | null {
  if (a.unlimited) return null;
  return Math.min(monthlyLeft(a), left(a.window) ?? Infinity, left(a.week) ?? Infinity);
}

const lagosDay = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" });

// A time later today or tomorrow in Lagos, e.g. "4:40 pm" or "tomorrow at 1:05 am".
export function lagosTime(at: string | Date, now: Date = new Date()): string {
  const when = new Date(at);
  const time = when
    .toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s+/g, " ")
    .toLowerCase();
  return lagosDay(when) === lagosDay(now) ? time : `tomorrow at ${time}`;
}

// When something refills, in words: "at 4:40 pm", "tomorrow at 1:05 am" or "on Mon 30 Nov at 9:00 am".
export function refillWhen(at: string | Date, now: Date = new Date()): string {
  const when = new Date(at);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (lagosDay(when) === lagosDay(now)) return `at ${lagosTime(when, now)}`;
  if (lagosDay(when) === lagosDay(tomorrow)) return lagosTime(when, now);
  const day = when.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" });
  const time = when
    .toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s+/g, " ")
    .toLowerCase();
  return `on ${day} at ${time}`;
}

// A date in Lagos, e.g. "27 Dec".
function lagosDate(at: string): string {
  return new Date(at).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });
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

export const TRIAL_ENDED_MESSAGE = "Your 7-day free trial has ended. Choose a plan to keep studying with Lawdeck.";

const plural = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;

export function limitReachedMessage(a: Allowance, now: Date = new Date()): string {
  if (a.limit === 0) return a.trial ? TRIAL_ENDED_MESSAGE : CLOSED_PILOT_MESSAGE;
  if (monthlyLeft(a) === 0) {
    if (a.trial) return `You’ve used all ${plural(a.limit)} of your free trial. Choose a plan to keep studying.`;
    if (a.periodEndsAt) {
      return `You’ve used all ${plural(a.limit)} for this paid month (until ${lagosDate(a.periodEndsAt)}). Pay for another month on Plans to keep going.`;
    }
    return `You’ve used all ${plural(a.limit)} for this month. You can ask again from ${resetDay(now)}.`;
  }
  if (a.week && left(a.week) === 0) {
    const when = a.week.resetsAt ? `They refill ${refillWhen(a.week.resetsAt, now)}.` : "Please try again later.";
    return `You’ve used your ${plural(a.week.limit)} for this week. ${when}`;
  }
  if (a.window && left(a.window) === 0) {
    const when = a.window.resetsAt ? lagosTime(a.window.resetsAt, now) : null;
    const again = !when ? "Please try again later." : `You can ask again ${when.startsWith("tomorrow") ? when : `at ${when}`}.`;
    return `You’ve used your ${plural(a.window.limit)} for now. ${again}`;
  }
  return "Please try again later.";
}

// The note under the question box, e.g. "12 of 30 credits left this month", or with the shorter
// limits "6 of 8 left for now · 19 of 25 this week · 52 of 70 this month".
export function allowanceNote(a: Allowance): string | null {
  if (a.unlimited) return null;
  const parts: string[] = [];
  const inWindow = left(a.window);
  if (a.window && inWindow !== null) parts.push(`${inWindow} of ${a.window.limit} left for now`);
  const inWeek = left(a.week);
  if (a.week && inWeek !== null) parts.push(`${inWeek} of ${a.week.limit} this week`);
  if (parts.length === 0) {
    const scope = a.trial ? "in your free trial" : "this month";
    return `${monthlyLeft(a)} of ${plural(a.limit)} left ${scope}`;
  }
  parts.push(`${monthlyLeft(a)} of ${a.limit} ${a.trial ? "in your trial" : "this month"}`);
  return parts.join(" · ");
}
