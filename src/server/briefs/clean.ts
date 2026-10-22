import "server-only";
import { BRIEF_SECTIONS, NOT_COVERED_TEXT, type BriefKind } from "@/prompts/brief";
import type { BriefReply } from "@/schemas/brief";
import { checkWithLibrary, type FilterContext } from "@/server/learn/answerFilter";

export type BriefSection = { heading: string; text: string; covered: boolean; sources: number[] };

// Puts Claude's brief into the fixed sections for its kind, in order, and checks every one:
// a section must cite a supplied passage to count as covered; otherwise it says plainly that the
// library does not cover it (never filled from memory). Citations to passages that were not
// supplied are removed, and the citation check runs as in answers (authorities not in the
// library are marked removed; long quotations are cut).
export async function cleanBrief(reply: BriefReply, kind: BriefKind, context: FilterContext): Promise<BriefSection[]> {
  return Promise.all(
    BRIEF_SECTIONS[kind].map(async (heading, index) => {
      const raw =
        reply.sections.find((section) => section.heading.toLowerCase() === heading.toLowerCase()) ?? reply.sections[index];
      const sources = raw ? [...new Set(raw.sources)].filter((label) => context.labels.has(label)) : [];
      if (!raw || !raw.covered || sources.length === 0 || !raw.text.trim()) {
        return { heading, text: NOT_COVERED_TEXT, covered: false, sources: [] };
      }
      const text = (await checkWithLibrary(raw.text, context)).trim();
      return text ? { heading, text, covered: true, sources } : { heading, text: NOT_COVERED_TEXT, covered: false, sources: [] };
    }),
  );
}
