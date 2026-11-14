import "server-only";

// A pretend Claude for the staging load test only (founder approved, 2026-11-14): it waits about as long
// as Claude takes, then streams a fixed answer, so 500 test students can "ask" at no AI cost. It works
// only when LAWDECK_PRETEND_AI=1 AND APP_ENV=staging, and never on Vercel's production deployment.
// It contains no legal content: the answer only points to the first passage.

const FIRST_WORDS_MS = 1_200;
const CHUNK_MS = 80;
const ANSWER = [
  "## Short answer\n",
  "This is a load-test answer from Lawdeck's staging copy. ",
  "It is not legal content [S1].\n\n",
  "## The rule\n",
  "The passage found by the library search is shown as the source [S1].\n\n",
  "## Exam tip\n",
  "Staging only.\n",
];

export function pretendAiOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.LAWDECK_PRETEND_AI === "1" && env.APP_ENV === "staging" && env.VERCEL_ENV !== "production";
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("cancelled"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("cancelled"));
    });
  });

// Streams the fixed answer. Returns false if the request was cancelled.
export async function streamPretendAnswer(onText: (text: string) => void, signal?: AbortSignal): Promise<boolean> {
  try {
    await wait(FIRST_WORDS_MS, signal);
    for (const piece of ANSWER) {
      onText(piece);
      await wait(CHUNK_MS, signal);
    }
    return true;
  } catch {
    return false;
  }
}

export const PRETEND_MODEL = "pretend-staging";
export const PRETEND_TOKENS = { in: 3_000, out: 120 };
