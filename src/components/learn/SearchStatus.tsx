import { Heartbeat } from "@/components/ui/Heartbeat";
import { Spinner } from "@/components/ui/Spinner";

// What Lawdeck is doing while an answer is on its way: a heartbeat line while it searches the
// library, then a green tick and "Found N passages" (green only when the search really found
// material), or an amber mark when the library has nothing on it.
export function SearchStatus({ found, writing }: { found: number | undefined; writing: boolean }) {
  if (found === undefined)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Heartbeat />
        Searching the library…
      </p>
    );
  if (found === 0)
    return (
      <p className="flex items-center gap-2 text-sm text-warning">
        <span aria-hidden="true">!</span>
        Not enough in the library for this question
      </p>
    );
  return (
    <p className="flex items-center gap-2 text-sm">
      <svg aria-hidden="true" width={16} height={16} viewBox="0 0 16 16" fill="none" className="shrink-0 text-success">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth={1.6} />
        <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-success">
        Found {found} passage{found === 1 ? "" : "s"}
      </span>
      {!writing && (
        <span className="flex items-center gap-2 text-muted">
          · writing the answer
          <Spinner size={14} />
        </span>
      )}
    </p>
  );
}
