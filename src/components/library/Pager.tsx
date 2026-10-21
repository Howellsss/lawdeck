import Link from "next/link";

// "Previous / Next" links for long lists, with the current position.
export function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Passage pages" className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? <Link href={hrefFor(page - 1)}>Previous</Link> : <span />}
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? <Link href={hrefFor(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}
