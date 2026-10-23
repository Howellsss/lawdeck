import type { ChatSource } from "@/server/db/workspace";

const GROUPS = [
  { origin: "library", title: "From the Lawdeck library" },
  { origin: "upload", title: "From your uploads" },
] as const;

// The sources an answer cites, under the answer, grouped by where they come from (step 6c).
// Each opens its passage in the right panel.
export function SourceList({
  sources,
  onOpen,
}: {
  sources: ChatSource[];
  onOpen: (source: ChatSource) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Sources
      </p>
      {GROUPS.map((group) => {
        const list = sources.filter(
          (source) => (source.origin ?? "library") === group.origin,
        );
        if (list.length === 0) return null;
        return (
          <div key={group.origin} className="flex flex-col gap-1">
            <p className="text-xs text-muted">{group.title}</p>
            <ul className="flex flex-col gap-1">
              {list.map((source) => (
                <li key={source.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(source)}
                    className="text-left text-sm underline underline-offset-2 hover:text-ink"
                  >
                    S{source.label} ·{" "}
                    {[source.itemTitle, source.heading, source.pages]
                      .filter(Boolean)
                      .join(" · ")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
