// Shapes shared by the practice screens and the server (Phase 4, step 4b).

export type PracticeSource = { label: number; title: string; heading: string | null; pages: string | null };

// The sources saved with a practice item: titles and labels only, never passage text.
export function parsePracticeSources(value: unknown): PracticeSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { label, title, heading, pages } = entry as Record<string, unknown>;
    if (typeof label !== "number" || typeof title !== "string") return [];
    return [{ label, title, heading: typeof heading === "string" ? heading : null, pages: typeof pages === "string" ? pages : null }];
  });
}

export function parseChoices(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((choice) => typeof choice === "string") ? (value as string[]) : null;
}

// "B" for choice 1: options are shown as letters.
export function choiceLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

// Revealed after a multiple-choice answer, or when a student asks to see a model answer.
export type PracticeReveal = { answer: string; correctChoice: number | null; sources: PracticeSource[] };
