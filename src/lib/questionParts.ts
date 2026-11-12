// The lettered parts of a problem question: "(a) Advise ... (b) Draft ... (c) ...", or roman
// numerals "(i) ... (ii) ...". Found without any AI call (founder, 2026-11-12: a six-part
// question was answered "Not enough in the Lawdeck library" because only four issues were searched
// and the answer gave up on the whole question). Pure, so it can be tested.

// A part marker at the start of a line, or after a full stop, colon or semicolon: "(a)", "a)",
// "a.", "(iv)". Mid-sentence brackets such as "section 20(a)" are not parts.
const MARKER = /(?:^|\n|[.:;?]\s+)[ \t]*\(?((?:[a-h])|(?:i{1,3}|iv|v|vi{0,3}|ix|x))[).][ \t]+/gi;

export type QuestionParts = { facts: string; parts: { label: string; text: string }[] };

export function splitParts(question: string): QuestionParts | null {
  const matches = [...question.matchAll(MARKER)];
  if (matches.length < 2) return null;
  // Parts run in order (a, b, c... or i, ii, iii...), starting from the first.
  const labels = matches.map((m) => m[1].toLowerCase());
  const letters = labels.every((l, i) => l === String.fromCharCode(97 + i));
  const romans = labels.every((l, i) => l === ROMANS[i]);
  if (!letters && !romans) return null;
  const parts = matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? punctuationEnd(matches[i + 1]) : question.length;
    return { label: `(${labels[i]})`, text: question.slice(start, end).replace(/\s+/g, " ").trim() };
  });
  if (parts.some((p) => p.text.split(" ").length < 2)) return null;
  // A marker's leading punctuation ("... as follows: (a)") belongs to the text before it.
  const facts = question.slice(0, punctuationEnd(matches[0])).trim();
  return { facts, parts };
}

function punctuationEnd(match: RegExpMatchArray): number {
  return (match.index ?? 0) + (/^[.:;?]/.test(match[0]) ? 1 : 0);
}

const ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

// The parts as at most `max` library searches: neighbouring parts share a search when there are
// more parts than searches, so every part is searched and no more searches run than before.
export function partSearches(parts: QuestionParts["parts"], max: number): string[] {
  if (parts.length === 0 || max < 1) return [];
  const groups = Math.min(max, parts.length);
  const size = Math.ceil(parts.length / groups);
  const searches: string[] = [];
  for (let i = 0; i < parts.length; i += size)
    searches.push(
      parts
        .slice(i, i + size)
        .map((p) => p.text)
        .join(" ")
        .slice(0, 400),
    );
  return searches;
}
