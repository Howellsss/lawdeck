import { readLibraryItem } from "@/server/library/actions";
import type { ReadStepResult } from "@/server/library/reading";

// More steps than any 25 MB file needs; stops a fault from looping for ever.
const MAX_STEPS = 400;

export type ReadProgress = { pagesRead: number; pageCount: number };

// Asks the server to read an item's file step by step until it is done or fails,
// reporting how many pages have been read after each step.
export async function readUntilDone(
  id: string,
  start: boolean,
  onProgress: (progress: ReadProgress) => void,
): Promise<ReadStepResult> {
  let result: ReadStepResult = { ok: false, message: "Reading did not start. Please try again." };
  for (let step = 0; step < MAX_STEPS; step++) {
    try {
      result = await readLibraryItem(id, start && step === 0);
    } catch {
      return { ok: false, message: "The connection was lost while reading. Use “Continue reading” to carry on." };
    }
    if (!result.ok || result.done) return result;
    onProgress({ pagesRead: result.pagesRead, pageCount: result.pageCount });
  }
  return { ok: false, message: "Reading is taking too long. Use “Continue reading” to carry on." };
}

export function progressText({ pagesRead, pageCount }: ReadProgress): string {
  return pageCount > 0 ? `Reading… ${pagesRead} of ${pageCount} pages read` : "Reading…";
}
