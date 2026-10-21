// Suggestions for a library file's details from its file name (Drive import). They are only
// suggestions: the admin sees and can change every one before importing.

type Course = { id: string; name: string };

const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];

// Letters that differ between two words (Levenshtein distance), for small spelling slips.
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

// The course whose own distinctive word (one no other course name uses) appears in the file
// name, allowing one slip in longer words. No guess when none, or more than one, matches.
export function guessCourse(fileName: string, courses: Course[]): string | null {
  const nameWords = words(fileName);
  const counts = new Map<string, number>();
  for (const course of courses) for (const word of new Set(words(course.name))) counts.set(word, (counts.get(word) ?? 0) + 1);
  const matches = courses.filter((course) =>
    words(course.name)
      .filter((word) => counts.get(word) === 1 && word.length >= 4)
      .some((word) => nameWords.some((w) => w === word || (word.length >= 6 && distance(w, word) <= 1))),
  );
  return matches.length === 1 ? matches[0].id : null;
}

// The last year from 1960 to next year in the file name, e.g. "Handbook 2025.docx" → "2025".
export function guessYear(fileName: string, now = new Date()): string {
  const years = (fileName.match(/(?<!\d)(19[6-9]\d|20\d\d)(?!\d)/g) ?? []).filter(
    (year) => Number(year) <= now.getUTCFullYear() + 1,
  );
  return years.at(-1) ?? "";
}

// A readable title: no extension, no copy markers like "(1)" or "[1]", tidy spacing.
export function titleFromFileName(fileName: string): string {
  return (
    fileName
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/\(\d+\)|\[\d+\]/g, " ")
      .replace(/[_+]+/g, " ")
      .replace(/\s*-\d+\s*$/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300) || "Untitled"
  );
}
