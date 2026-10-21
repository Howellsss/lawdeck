import type { LibraryItemSummary } from "@/server/db/library";

// Below this share of readable pages, the reading is flagged for a closer look.
const LOW_QUALITY = 0.8;

const METHOD_LABELS = { text: "text", scan: "scanned", mixed: "text and scanned" } as const;

// One line on how far an item's file has been read, in plain words.
export function ReadingSummary({ reading }: { reading: LibraryItemSummary["reading"] }) {
  if (reading.status === "waiting") return <span className="text-muted">Not read yet</span>;
  if (reading.status === "reading") {
    return (
      <span className="text-muted">
        {reading.pageCount ? `Reading stopped at ${reading.pagesRead} of ${reading.pageCount} pages` : "Reading started"}
      </span>
    );
  }
  if (reading.status === "failed") {
    return <span className="text-warning">Reading failed: {reading.error ?? "please try again."}</span>;
  }
  const parts = [
    `${reading.passages} ${reading.passages === 1 ? "passage" : "passages"}`,
    reading.pageCount ? `${reading.pageCount} ${reading.pageCount === 1 ? "page" : "pages"}` : null,
    reading.method ? METHOD_LABELS[reading.method] : null,
  ].filter(Boolean);
  const quality = reading.quality ?? 0;
  return (
    <span>
      <span className="text-muted">Read: {parts.join(" · ")} · </span>
      <span className={quality < LOW_QUALITY ? "text-warning" : "text-muted"}>
        {Math.round(quality * 100)}% of pages readable{quality < LOW_QUALITY ? " (check it)" : ""}
      </span>
    </span>
  );
}
