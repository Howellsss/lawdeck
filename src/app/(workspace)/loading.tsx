// Shown while a workspace page is loading (rule I-01: every screen has a loading state).
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 items-center justify-center p-10 text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden="true" />
      <span className="ml-3 text-sm">Loading…</span>
    </div>
  );
}
