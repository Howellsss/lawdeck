import type { Allowance } from "./allowance";

// The 7-day free trial as the student sees it (founder, 2026-11-28: "users get to see that it's 7
// days free trial … demand payments after the 7 days"). Worked out from the allowance (migration 74).
export type TrialStatus =
  | { state: "active"; daysLeft: number; endsAt: string; creditsLeft: number; credits: number }
  | { state: "ending"; daysLeft: number; endsAt: string; creditsLeft: number; credits: number }
  | { state: "used"; endsAt: string; credits: number }
  | { state: "ended" };

const DAY = 86_400_000;

// Null when the student is not on the trial (paid, staff, or no data).
export function trialStatus(a: Allowance | null, now: Date = new Date()): TrialStatus | null {
  if (!a || !a.trial || a.unlimited) return null;
  if (a.limit === 0 || !a.periodEndsAt || new Date(a.periodEndsAt).getTime() <= now.getTime()) return { state: "ended" };
  const creditsLeft = Math.max(a.limit - a.used, 0);
  if (creditsLeft === 0) return { state: "used", endsAt: a.periodEndsAt, credits: a.limit };
  const daysLeft = Math.max(1, Math.ceil((new Date(a.periodEndsAt).getTime() - now.getTime()) / DAY));
  const base = { daysLeft, endsAt: a.periodEndsAt, creditsLeft, credits: a.limit };
  return daysLeft <= 2 ? { state: "ending", ...base } : { state: "active", ...base };
}

// "Wed 3 Dec" in Lagos.
export function trialEndDay(endsAt: string): string {
  return new Date(endsAt).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" });
}

// The line in the trial banner.
export function trialBannerText(t: TrialStatus): string {
  switch (t.state) {
    case "active":
      return `Free trial: ${t.daysLeft} days left (ends ${trialEndDay(t.endsAt)}) · ${t.creditsLeft} of ${t.credits} trial credits left · no card needed.`;
    case "ending":
      return `Your free trial ends ${t.daysLeft === 1 ? "within a day" : "in 2 days"} (${trialEndDay(t.endsAt)}) · ${t.creditsLeft} of ${t.credits} trial credits left. Choose a plan to keep studying without a break.`;
    case "used":
      return `You’ve used all ${t.credits} trial credits. Choose a plan to keep studying; your trial would have ended on ${trialEndDay(t.endsAt)}.`;
    case "ended":
      return "Your 7-day free trial has ended. Choose a plan to keep asking questions, practising and drafting. Your notes, documents and progress are kept.";
  }
}
