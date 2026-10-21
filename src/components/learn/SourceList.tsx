import type { ChatSource } from "@/server/db/workspace";

// The sources an answer cites, under the answer. Each opens its passage in the right panel.
export function SourceList({ sources, onOpen }: { sources: ChatSource[]; onOpen: (source: ChatSource) => void }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Sources</p>
      <ul className="flex flex-col gap-1">
        {sources.map((source) => (
          <li key={source.id}>
            <button
              type="button"
              onClick={() => onOpen(source)}
              className="text-left text-sm underline underline-offset-2 hover:text-ink"
            >
              S{source.label} · {[source.itemTitle, source.heading, source.pages].filter(Boolean).join(" · ")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
