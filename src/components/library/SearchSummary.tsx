import type { LibraryItemSummary } from "@/server/db/library";

// Whether an item's passages can be found by search yet, in plain words.
export function SearchSummary({ item, currentModel }: { item: LibraryItemSummary; currentModel: string }) {
  if (item.reading.status !== "done") return null;
  const { indexed, model } = item.search;
  const total = item.reading.passages;
  if (model !== currentModel || indexed === 0) {
    return <span className="text-warning">Not indexed for search yet</span>;
  }
  if (indexed < total) {
    return <span className="text-warning">Indexed for search: {indexed} of {total} passages (not finished)</span>;
  }
  return <span className="text-muted">Indexed for search: all {total} passages</span>;
}

// True when an admin should be offered "Index for search".
export function needsIndexing(item: LibraryItemSummary, currentModel: string): boolean {
  return (
    item.reading.status === "done" &&
    (item.search.model !== currentModel || item.search.indexed < item.reading.passages)
  );
}
