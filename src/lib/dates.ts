// Dates are stored in UTC and shown in West Africa Time (Lagos), per the Quality rules.
const WAT = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatWat(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : WAT.format(date);
}

// A calendar date (YYYY-MM-DD, no time) shown in words, e.g. "1 Mar 2024".
const DATE_ONLY = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDateWat(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : DATE_ONLY.format(date);
}
