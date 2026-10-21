"use server";

import { refresh } from "next/cache";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { libraryItemIdSchema, librarySearchSchema } from "@/schemas/library";
import { getStaffRole } from "@/server/auth/roles";
import { indexStep, type IndexStepResult } from "./indexJob";
import { searchLibrary, type SearchHit } from "./search";

// Gives an item's passages search vectors, one step at a time. Admins only: the role is checked
// here, on the server, before the admin job runs.
export async function indexLibraryItem(id: string): Promise<IndexStepResult> {
  const parsedId = libraryItemIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, message: "That item could not be found." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can index library items." };
  const result = await indexStep(parsedId.data);
  if (!result.ok || result.done) refresh();
  return result;
}

export type TestSearchResult =
  | { ok: true; hits: SearchHit[]; meaningUsed: boolean }
  | { ok: false; message?: string; fieldErrors?: FieldErrors };

// A reviewer's test search. Students will search through answers in Phase 3, never this page.
export async function testLibrarySearch(input: {
  question: string;
  courseId: string;
  includePending: boolean;
}): Promise<TestSearchResult> {
  const parsed = librarySearchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers and admins can test the search." };
  return searchLibrary(parsed.data);
}
