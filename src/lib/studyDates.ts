// Today's date in Lagos, YYYY-MM-DD.
export function lagosDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// The moment a Lagos day (YYYY-MM-DD) begins, as a UTC timestamp. Lagos is UTC+1 all year.
export function lagosDayStart(date: string): string {
  return new Date(`${date}T00:00:00+01:00`).toISOString();
}

// "Yesterday" when the last study was the day before today (Lagos), otherwise the date in words.
export function whenStudied(date: string, now: Date = new Date()): string {
  const today = new Date(`${lagosDate(now)}T00:00:00Z`).getTime();
  const then = new Date(`${date}T00:00:00Z`).getTime();
  const days = Math.round((today - then) / 86_400_000);
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return `On ${new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(then))}`;
}
