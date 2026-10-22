import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitReachedMessage } from "@/lib/allowance";
import { pagesLabel } from "@/lib/pages";
import type { NewBrief } from "@/schemas/brief";
import { makeBrief } from "@/server/ai/brief";
import { recordUsage } from "@/server/ai/usage";
import type { Database } from "@/server/db/types";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "@/server/learn/allowance";
import { normalise } from "@/server/learn/answerFilter";
import { searchUnsure } from "@/server/learn/ask";
import { filterContextFor } from "@/server/learn/filterContext";
import { searchLibrary, type SearchHit } from "@/server/retrieval/search";
import { cleanBrief } from "./clean";

type Db = SupabaseClient<Database>;

export type CreateBriefResult = { ok: true; id: string } | { ok: false; message: string };

export function notInLibraryMessage(kind: "case" | "statute"): string {
  return kind === "case"
    ? "This case isn’t in the Lawdeck library yet, so Lawdeck won’t brief it from memory. Check the spelling of both parties’ names, or try another case."
    : "This statute isn’t in the Lawdeck library yet, so Lawdeck won’t brief it from memory. Check the name, or try another statute or rules of court.";
}

const NOTHING_COVERED =
  "The library mentions this, but not enough to write a brief from. Try asking Lawdeck to explain the topic it belongs to instead.";

const FAILURES = {
  no_key: "Briefs are not switched on yet: the Claude key is missing on the server.",
  busy: "Lawdeck is busy right now. Please try again in a minute.",
  refused: "Lawdeck can’t write this brief. Try another case or statute.",
  unavailable: "Lawdeck could not reach the brief service. Please try again in a minute.",
  malformed: "Lawdeck could not write the brief this time. Please try again.",
} as const;

// The name as the whole-library lookup expects it (migration 16): "kolawole v alberto" for a
// case with two parties, otherwise the name as a phrase.
export function lookupFor(kind: "case" | "statute", name: string): { statutes: string[]; cases: string[] } {
  const key = normalise(name).replace(/\bvs?\b/g, "v").replace(/\s+/g, " ").trim();
  return kind === "case" && / v /.test(` ${key} `) ? { statutes: [], cases: [key] } : { statutes: [key], cases: [] };
}

// Writes and saves a brief for the signed-in student (PRD LN-09): the name must be in the approved
// library; Claude briefs it from the library passages only; each section is checked; the brief
// counts as one question once saved. Row-level security keeps it theirs.
export async function createBrief(db: Db, userId: string, input: NewBrief): Promise<CreateBriefResult> {
  let courseId: string | null = null;
  if (input.course !== "all") {
    const course = await db.from("courses").select("id").eq("slug", input.course).maybeSingle();
    if (course.error || !course.data) return { ok: false, message: "That course could not be found." };
    courseId = course.data.id;
  }

  // Rule K-01: the monthly limit is checked before anything else costs money.
  const allowance = await getAllowance(db);
  if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
  if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };

  // Is it in the approved library at all? If not, say so and stop: nothing is written from memory.
  const lookup = lookupFor(input.kind, input.name);
  const mentioned = await db.rpc("library_mentions", { ...lookup, course: courseId ?? undefined });
  if (mentioned.error) {
    console.error("brief failed", { step: "lookup", code: mentioned.error.code });
    return { ok: false, message: "Lawdeck couldn’t check the library just now. Please try again." };
  }
  if (mentioned.data.length === 0) return { ok: false, message: notInLibraryMessage(input.kind) };

  const found = await searchLibrary({ question: input.name, courseId, includePending: false });
  if (!found.ok) return { ok: false, message: found.message };
  const unsure = searchUnsure(found);
  if (unsure) return { ok: false, message: unsure };
  if (found.hits.length === 0) return { ok: false, message: notInLibraryMessage(input.kind) };

  const hits = found.hits.map((hit, index) => ({ ...hit, label: index + 1 }));
  const made = await makeBrief({
    passages: hits.map((hit) => ({ label: hit.label, itemTitle: hit.itemTitle, heading: hit.heading, pages: pagesLabel(hit.pageFrom, hit.pageTo), text: hit.text })),
    kind: input.kind,
    name: input.name,
    userId,
  });
  if (!made.ok) return { ok: false, message: FAILURES[made.reason] };
  if (!made.reply.found) return { ok: false, message: notInLibraryMessage(input.kind) };

  const sections = await cleanBrief(made.reply, input.kind, await filterContextFor(db, hits, courseId));
  if (!sections.some((section) => section.covered)) return { ok: false, message: NOTHING_COVERED };

  const saved = await db
    .from("briefs")
    .insert({ course_id: courseId, kind: input.kind, name: input.name, sections, sources: sourcesFor(sections, hits), model: made.model })
    .select("id")
    .single();
  if (saved.error) {
    console.error("brief failed", { step: "save", code: saved.error.code });
    return { ok: false, message: "The brief was not saved. Please try again." };
  }
  // A saved brief counts as one question this month (founder's decision); failed ones are free.
  await recordUsage({ kind: "brief", model: made.model, costUsd: made.costUsd, ...made.usage });
  return { ok: true, id: saved.data.id };
}

// The passages the brief cites: title, heading, pages and passage id, never the passage text.
function sourcesFor(sections: { sources: number[] }[], hits: (SearchHit & { label: number })[]) {
  const labels = [...new Set(sections.flatMap((section) => section.sources))].sort((a, b) => a - b);
  return labels
    .map((label) => hits.find((hit) => hit.label === label))
    .filter((hit) => hit !== undefined)
    .map((hit) => ({
      label: hit.label,
      passageId: hit.passageId,
      title: hit.itemTitle.slice(0, 300),
      heading: hit.heading?.slice(0, 500) ?? null,
      pages: pagesLabel(hit.pageFrom, hit.pageTo),
    }));
}
