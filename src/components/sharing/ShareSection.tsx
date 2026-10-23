import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import type { ShareKind } from "@/schemas/sharing";
import { listShares } from "@/server/db/sharing";
import { NewShareButton } from "./NewShareButton";
import { ShareLink } from "./ShareLink";

// "Share" on a document or project page (PRD EX-04): view-only links, who opened them, and a
// way to turn each off. Anyone with a link must sign in to Lawdeck to see the work.
export function ShareSection({ kind, id }: { kind: ShareKind; id: string }) {
  return (
    <section aria-labelledby="share-heading" className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 id="share-heading" className="text-lg font-medium">
        Share
      </h2>
      <p className="text-sm text-muted">
        {kind === "document"
          ? "Anyone with a link can read this document after signing in to Lawdeck. They can’t change it."
          : "Anyone with a link can read this project’s documents and chats (with the names of the sources its answers used) after signing in to Lawdeck. They can’t change them."}{" "}
        Turning a link off stops it working at once.
      </p>
      <Suspense fallback={<LoadingRows label="Loading your links" />}>
        <Links kind={kind} id={id} />
      </Suspense>
    </section>
  );
}

async function Links({ kind, id }: { kind: ShareKind; id: string }) {
  const shares = await listShares(kind, id);
  return (
    <>
      {shares.length > 0 && (
        <ul aria-label="Your view-only links" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {shares.map((share) => (
            <ShareLink key={share.id} share={share} />
          ))}
        </ul>
      )}
      <NewShareButton kind={kind} id={id} />
    </>
  );
}
