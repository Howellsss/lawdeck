// What still stands in the way of approving a library item, in plain words.
// The database enforces the same rules (migration 8); this only explains them on screen.
export type ApprovalState = {
  readingStatus: "waiting" | "reading" | "done" | "failed";
  passages: number;
  indexedPassages: number;
  indexModel: string | null;
  indexedAt: string | null;
};

export function approvalBlockers(item: ApprovalState, currentModel: string): string[] {
  const blockers: string[] = [];
  if (item.readingStatus !== "done" || item.passages === 0) blockers.push("The file has not been read yet.");
  else if (
    item.indexedAt === null ||
    item.indexModel !== currentModel ||
    item.indexedPassages < item.passages
  ) {
    blockers.push("Not every passage is indexed for search yet. An admin can finish it with “Index for search”.");
  }
  return blockers;
}

// Today in West Africa Time as YYYY-MM-DD, the latest allowed "current as of" date.
export function todayInLagos(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(now);
}
