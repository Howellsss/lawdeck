import type { LessonContent } from "@/schemas/lesson";

// Skim, tick and approve (docs/specs/remembrance.md): a reviewer reads a lesson section by section
// and ticks each one. Plain rules, shared by the screen and the server's final check.
export type Verdict = "checked" | "problem";
export type SectionTick = { section: number; verdict: Verdict; note: string | null };

export type ReadingState = {
  sections: number;
  checked: number;
  problems: SectionTick[];
  // Sections not yet ticked, in order.
  missing: number[];
  // Every section checked and none a problem: ready to approve as read in full.
  canApprove: boolean;
  // Every section ticked and at least one problem: ready to send back for a fix.
  canSendBack: boolean;
};

// What must be ticked: every section, plus the end-of-topic test as one more item when it has
// questions (students see those too).
export function partsToRead(sectionCount: number, testQuestions: number): number {
  return sectionCount + (testQuestions > 0 ? 1 : 0);
}

export function readingState(sectionCount: number, ticks: SectionTick[]): ReadingState {
  const bySection = new Map(ticks.filter((t) => t.section >= 0 && t.section < sectionCount).map((t) => [t.section, t]));
  const missing = Array.from({ length: sectionCount }, (_, i) => i).filter((i) => !bySection.has(i));
  const problems = [...bySection.values()].filter((t) => t.verdict === "problem").sort((a, b) => a.section - b.section);
  const checked = [...bySection.values()].filter((t) => t.verdict === "checked").length;
  return {
    sections: sectionCount,
    checked,
    problems,
    missing,
    canApprove: sectionCount > 0 && missing.length === 0 && problems.length === 0,
    canSendBack: problems.length > 0,
  };
}

// The note sent back with a lesson that has problems: each problem with its section heading.
export function sendBackNote(content: LessonContent, problems: SectionTick[]): string {
  return problems
    .map((p) => `${content.sections[p.section]?.heading ?? (p.section === content.sections.length ? "End-of-topic test" : `Section ${p.section + 1}`)}: ${p.note ?? ""}`.trim())
    .join("\n")
    .slice(0, 2000);
}

// The authority cards named in one section, by the keys on its marked phrases, in order of first use.
export function authorityKeysInSection(content: LessonContent, section: number): string[] {
  const keys: string[] = [];
  for (const paragraph of content.sections[section]?.paragraphs ?? []) {
    for (const mark of paragraph.marks) if (mark.authority && !keys.includes(mark.authority)) keys.push(mark.authority);
  }
  return keys;
}

// Which lessons still need reading in full: awaiting review, or approved with their course.
export function needsReading(lesson: { status: string; bulk_approved: boolean }): boolean {
  return lesson.status === "pending" || (lesson.status === "approved" && lesson.bulk_approved);
}
