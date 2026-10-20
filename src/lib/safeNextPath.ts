// Where to send someone after sign-in. Only paths on Lawdeck itself are allowed,
// so a link like ?next=https://evil.example cannot bounce a student to another site.
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  // "//host" and "/\host" are treated by browsers as another site.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters and backslashes are never part of a real Lawdeck path.
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://lawdeck.invalid");
    if (url.origin !== "https://lawdeck.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
