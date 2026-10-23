import { readUpload } from "@/server/uploads/actions";

// More steps than any 25 MB file needs; stops a fault from looping for ever.
const MAX_STEPS = 400;

export type ReadOutcome =
  | { ok: true; passages: number }
  | { ok: false; message: string };

// Asks the server to read an upload step by step until it is ready or stops, reporting progress.
export async function readUploadUntilDone(
  id: string,
  onProgress: (text: string) => void,
): Promise<ReadOutcome> {
  for (let step = 0; step < MAX_STEPS; step++) {
    let result;
    try {
      result = await readUpload(id);
    } catch {
      return {
        ok: false,
        message:
          "The connection was lost while reading. Use “Try again” to carry on.",
      };
    }
    if (!result.ok) return result;
    if (result.done) return { ok: true, passages: result.passages };
    onProgress(
      result.pageCount > 0
        ? `Reading… ${result.pagesRead} of ${result.pageCount} pages read.`
        : "Reading…",
    );
  }
  return {
    ok: false,
    message: "Reading is taking too long. Use “Try again” to carry on.",
  };
}
