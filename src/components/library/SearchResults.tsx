import type { SearchHit } from "@/server/retrieval/search";

function pages(hit: SearchHit) {
  if (hit.pageFrom === null) return null;
  return hit.pageTo && hit.pageTo !== hit.pageFrom ? `pages ${hit.pageFrom}–${hit.pageTo}` : `page ${hit.pageFrom}`;
}

function foundBy(hit: SearchHit) {
  const ways = [
    hit.meaningRank !== null ? `meaning #${hit.meaningRank}` : null,
    hit.wordsRank !== null ? `exact words #${hit.wordsRank}` : null,
  ].filter(Boolean);
  return `Found by ${ways.join(" and ")}`;
}

// The passages a test search returned, best first.
export function SearchResults({
  hits,
  meaningUsed,
  reranked,
}: {
  hits: SearchHit[];
  meaningUsed: boolean;
  reranked: boolean;
}) {
  return (
    <section aria-labelledby="search-results" className="flex flex-col gap-3">
      <h2 id="search-results" className="text-lg font-medium">
        Results ({hits.length})
      </h2>
      {!meaningUsed && (
        <p role="alert" className="rounded-2xl border border-warning px-4 py-3 text-sm text-warning">
          Search by meaning is not available (Voyage AI could not be reached or the key is missing), so these
          results use exact words only.
        </p>
      )}
      {meaningUsed && !reranked && hits.length > 1 && (
        <p role="alert" className="rounded-2xl border border-warning px-4 py-3 text-sm text-warning">
          The re-ranking step did not answer in time, so these results are in the search&apos;s own order and may be
          less precise. Try again in a moment.
        </p>
      )}
      {hits.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          Nothing matched. Check the course, and that its material has been read and indexed for search.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {hits.map((hit) => (
            <li key={hit.passageId} className="flex flex-col gap-1 px-4 py-4">
              <p className="break-words text-[15px] font-medium">{hit.heading ?? "(No heading)"}</p>
              <p className="text-sm text-muted">
                {[hit.itemTitle, pages(hit), foundBy(hit)].filter(Boolean).join(" · ")}
              </p>
              <details className="text-sm">
                <summary className="cursor-pointer underline underline-offset-2">Show the passage</summary>
                <p className="mt-2 whitespace-pre-line break-words">{hit.text}</p>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
