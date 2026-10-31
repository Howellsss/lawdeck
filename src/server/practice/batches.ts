import type { PracticeReply } from "@/schemas/practice";

// Faster practice sets (founder, 2026-10-31: "it took over 2 minutes to create questions"): a set is
// written as several small batches at the same time instead of one long reply. Each batch gets its
// own share of the passages (dealt out in turn), so batches cover different points and do not
// repeat each other. The model, its settings and the instructions are unchanged.

export const QUESTIONS_PER_BATCH = 2;

export function planBatches<T>(hits: T[], count: number, perBatch = QUESTIONS_PER_BATCH): { hits: T[]; count: number }[] {
  const batches = Math.max(1, Math.min(Math.ceil(count / perBatch), hits.length));
  if (batches === 1) return [{ hits, count }];
  return Array.from({ length: batches }, (_, b) => ({
    hits: hits.filter((_, i) => i % batches === b),
    // Questions shared out evenly: 7 in 3 batches is 3, 2, 2.
    count: Math.floor(count / batches) + (b < count % batches ? 1 : 0),
  }));
}

// One reply from the batches' replies: every item, in batch order; "not enough" if any batch said so.
export function mergeReplies(replies: PracticeReply[]): PracticeReply {
  return { notEnough: replies.some((reply) => reply.notEnough), items: replies.flatMap((reply) => reply.items) };
}
