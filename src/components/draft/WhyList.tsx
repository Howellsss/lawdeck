"use client";

import type { WhyEntry } from "@/server/db/documents";

// "Why is it arranged this way?" (DR-08): each part in order, what it does and the rule behind
// it, from the reviewed template. On a document, each part can be found on the pages.
export function WhyList({ entries, onShow }: { entries: WhyEntry[]; onShow?: (partId: string) => void }) {
  return (
    <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
      {entries.map((entry, i) => (
        <li key={entry.partId} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium">
              {i + 1}. {entry.heading ?? entry.partId}
            </span>
            {entry.onlyFor && <span className="text-sm text-muted">Only for: {entry.onlyFor.join(", ")}</span>}
            {onShow && (
              <button type="button" onClick={() => onShow(entry.partId)} className="ml-auto text-sm underline underline-offset-2">
                Show on the pages
              </button>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted">{entry.why}</p>
        </li>
      ))}
    </ol>
  );
}
