import Link from "next/link";
import type { RelatedDocument } from "@/server/db/documents";

// The documents that usually go with this one (DR-09). Drafting one carries over the answers
// both share (parties, addresses, court, counsel). Unreviewed ones are listed but not offered.
export function RelatedDocuments({ documentId, related }: { documentId: string; related: RelatedDocument[] }) {
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-heading" className="flex flex-col gap-2">
      <h2 id="related-heading" className="text-lg font-medium">
        Documents that go with this
      </h2>
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        {related.map((doc) => (
          <li key={doc.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="font-medium">{doc.title}</span>
            {doc.available ? (
              <Link href={`/drafting/${doc.slug}?from=${documentId}`} className="ml-auto text-sm">
                Draft it with the same facts
              </Link>
            ) : (
              <span className="ml-auto text-sm text-muted">Awaiting review</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
