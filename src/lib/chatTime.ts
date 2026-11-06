import { lagosDate } from "./studyDates";

// Times and day markers in campus chat, in West Africa Time (CLAUDE.md: stored in UTC, shown in WAT).
export function watTime(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
}

export function watDay(iso: string): string {
  return lagosDate(new Date(iso));
}

// "Today", "Yesterday", or "Monday 3 November" (with the year when it is not this year).
export function dayLabel(day: string, now: Date = new Date()): string {
  const today = lagosDate(now);
  const ms = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const diff = Math.round((ms(today) - ms(day)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: sameYear ? undefined : "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  ).replace(",", "");
}

// Messages from the same person within 5 minutes sit under one name, as in Slack.
export function startsRun(prev: { authorId: string; createdAt: string } | undefined, cur: { authorId: string; createdAt: string }): boolean {
  if (!prev || prev.authorId !== cur.authorId) return true;
  if (watDay(prev.createdAt) !== watDay(cur.createdAt)) return true;
  return new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
}
