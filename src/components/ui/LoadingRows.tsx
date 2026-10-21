// Placeholder rows while a list loads (rule I-01: every screen has a loading state).
export function LoadingRows({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} aria-hidden="true" className="h-14 animate-pulse rounded-2xl bg-pill" />
      ))}
    </div>
  );
}
