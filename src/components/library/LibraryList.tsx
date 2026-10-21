import Link from "next/link";
import { formatWat } from "@/lib/dates";
import { KB_ITEM_TYPES, REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import type { LibraryItemSummary } from "@/server/db/library";
import type { RecheckReason } from "@/server/db/lawChanges";
import { ReadingSummary } from "./ReadingSummary";
import { IndexItemButton } from "./IndexItemButton";
import { ReadItemButton } from "./ReadItemButton";
import { RemoveItemButton } from "./RemoveItemButton";
import { needsIndexing, SearchSummary } from "./SearchSummary";

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
export function LibraryList({
  items,
  isAdmin,
  currentModel,
  recheck,
}: {
  items: LibraryItemSummary[];
  isAdmin: boolean;
  currentModel: string;
  recheck: Map<string, RecheckReason[]>;
}) {
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
        // Details first, then the actions underneath, so long messages never squeeze the title.
        <li key={item.id} className="flex flex-col gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="break-words text-[15px] font-medium">
              <Link href={`/admin/library/${item.id}`} className="no-underline hover:underline">
                {item.title}
              </Link>
            </p>
            <p className="text-sm text-muted">
              {[item.courseName, KB_ITEM_TYPES[item.type], item.year, item.fileName, megabytes(item.sizeBytes)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-sm">
              <span className={STATUS_TONE[item.reviewStatus]}>{REVIEW_STATUS_LABELS[item.reviewStatus]}</span>
              <span className="text-muted"> · Added {formatWat(item.createdAt)}</span>
            </p>
            {recheck.has(item.id) && (
              <p className="text-sm text-warning">
                Needs re-check: {recheck.get(item.id)?.[0]?.changeTitle}
                {(recheck.get(item.id)?.length ?? 0) > 1 ? ` and ${(recheck.get(item.id)?.length ?? 1) - 1} more` : ""}
              </p>
            )}
            <p className="text-sm">
              <ReadingSummary reading={item.reading} />
            </p>
            <p className="text-sm">
              <SearchSummary item={item} currentModel={currentModel} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Link href={`/admin/library/${item.id}`} className="text-sm">
              Review<span className="sr-only"> {item.title}</span>
            </Link>
            {isAdmin && (
              <>
                <ReadItemButton id={item.id} title={item.title} status={item.reading.status} />
                {needsIndexing(item, currentModel) && <IndexItemButton id={item.id} title={item.title} />}
                <RemoveItemButton id={item.id} title={item.title} />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
