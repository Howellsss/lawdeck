// What each bulk panel on Admin → Lessons writes, and its cost per topic (US$, AI cost model:
// Opus for lessons with up to 40 passages; a shorter Opus call for memory aids and stories).
export const LESSON_COST = { low: 0.2, high: 0.5 } as const;
export const EXTRAS_COST = { low: 0.1, high: 0.25 } as const;

export const BULK_KINDS = {
  lesson: {
    endpoint: "/api/admin/lessons/generate",
    title: "Write all missing lessons",
    verb: "Write",
    one: "lesson",
    many: "lessons",
    cost: LESSON_COST,
    lessons: true,
    none: "Every topic has a lesson.",
  },
  update: {
    endpoint: "/api/admin/lessons/generate",
    title: "Update lessons with new library material",
    verb: "Update",
    one: "lesson",
    many: "lessons",
    cost: LESSON_COST,
    lessons: true,
    none: "No lesson has new library material.",
  },
  extras: {
    endpoint: "/api/admin/lessons/extras",
    title: "Write memory aids and stories for every lesson",
    verb: "Write",
    one: "set of memory aids",
    many: "sets of memory aids",
    cost: EXTRAS_COST,
    lessons: false,
    none: "Every lesson has its memory aids and stories.",
  },
} as const;
export type BulkKind = keyof typeof BULK_KINDS;

// The cost range for n topics, in US dollars, with memory aids added after each lesson if asked.
export function bulkCost(kind: BulkKind, n: number, withAids: boolean): { low: string; high: string } {
  const k = BULK_KINDS[kind];
  const extra = k.lessons && withAids ? EXTRAS_COST : { low: 0, high: 0 };
  return { low: (n * (k.cost.low + extra.low)).toFixed(2), high: (n * (k.cost.high + extra.high)).toFixed(2) };
}
