// "p. 4" or "pp. 4–6" for a passage's pages; null when the file has no pages (Word files).
export function pagesLabel(from: number | null, to: number | null): string | null {
  if (from === null) return null;
  return to !== null && to !== from ? `pp. ${from}–${to}` : `p. ${from}`;
}
