import { formatWat } from "@/lib/dates";
import { KB_ITEM_TYPES, REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import type { LibraryItemSummary } from "@/server/db/library";
import { RemoveItemButton } from "./RemoveItemButton";

const STATUS_TONE = {
  pending: "text-muted",
  approved: "text-success",
  rejected: "text-warning",
  withdrawn: "text-warning",
} as const;

function megabytes(bytes: number | null) {
  return bytes === null ? "" : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Library items, newest first. Cards rather than a wide table, so it works at 360 px.
export function LibraryList({ items, canRemove }: { items: LibraryItemSummary[]; canRemove: boolean }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
        The library is empty. Upload the first file above.
      </p>
    );
  }
  return (
    <ul aria-label="Library items" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-[15px] font-medium">{item.title}</p>
            <p className="text-sm text-muted">
              {[item.courseName, KB_ITEM_TYPES[item.type], item.year, item.fileName, megabytes(item.sizeBytes)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-sm">
              <span className={STATUS_TONE[item.reviewStatus]}>{REVIEW_STATUS_LABELS[item.reviewStatus]}</span>
              <span className="text-muted"> · Added {formatWat(item.createdAt)} · Not yet read (step 2c)</span>
            </p>
          </div>
          {canRemove && (
            <div className="shrink-0">
              <RemoveItemButton id={item.id} title={item.title} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
