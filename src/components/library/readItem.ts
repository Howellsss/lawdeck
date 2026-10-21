import { readLibraryItem } from "@/server/library/actions";
import type { ReadStepResult } from "@/server/library/reading";
import { indexLibraryItem } from "@/server/retrieval/actions";
import type { IndexStepResult } from "@/server/retrieval/indexJob";

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
  return pageCount > 0 ? `Reading… ${pagesRead} of ${pageCount} pages read.` : "Reading…";
}

export type IndexProgress = { indexed: number; total: number };

// Asks the server to give an item's passages search vectors until it is done or fails.
export async function indexUntilDone(
  id: string,
  onProgress: (progress: IndexProgress) => void,
): Promise<IndexStepResult> {
  let result: IndexStepResult = { ok: false, message: "Indexing did not start. Please try again." };
  for (let step = 0; step < MAX_STEPS; step++) {
    try {
      result = await indexLibraryItem(id);
    } catch {
      return { ok: false, message: "The connection was lost while indexing. Use “Index for search” to carry on." };
    }
    if (!result.ok || result.done) return result;
    onProgress({ indexed: result.indexed, total: result.total });
  }
  return { ok: false, message: "Indexing is taking too long. Use “Index for search” to carry on." };
}

// Reads a file, then indexes it for search. Reading problems and indexing problems are
// reported separately, because a read file is still useful while indexing is retried.
export async function readAndIndex(
  id: string,
  start: boolean,
  onProgress: (text: string) => void,
): Promise<{ ok: true; passages: number } | { ok: false; stage: "read" | "index"; message: string }> {
  const read = await readUntilDone(id, start, (step) => onProgress(progressText(step)));
  if (!read.ok) return { ok: false, stage: "read", message: read.message };
  onProgress("Indexing for search…");
  const indexed = await indexUntilDone(id, (step) => onProgress(`Indexing for search… ${step.indexed} of ${step.total} passages.`));
  if (!indexed.ok) return { ok: false, stage: "index", message: indexed.message };
  return { ok: true, passages: read.passages ?? 0 };
}
