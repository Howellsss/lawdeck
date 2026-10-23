import type { ForumProfile } from "@/schemas/drafting";
import type { ForumSummary } from "@/server/db/drafting";
import { DraftingStatusBar } from "./DraftingStatusBar";

const PAGE_NUMBERS = {
  none: "no page numbers",
  "bottom-centre": "numbers bottom centre",
  "bottom-right": "numbers bottom right",
  "top-right": "numbers top right",
};
const SIGNER = {
  counsel: "signed by counsel",
  party: "signed by the party",
  both: "signed by counsel and the party",
};

// Courts and registries with their formatting profile, for reviewers to confirm (PRD 7.3).
export function ForumList({
  forums,
  isAdmin,
}: {
  forums: ForumSummary[];
  isAdmin: boolean;
}) {
  if (forums.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
        No courts or registries yet. Load them from the files.
      </p>
    );
  return (
    <ul
      aria-label="Courts and registries"
      className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface"
    >
      {forums.map((forum) => (
        <li key={forum.id} className="flex flex-col gap-2 px-4 py-4">
          <p className="break-words font-medium">{forum.name}</p>
          <p className="text-sm text-muted">
            {forum.kind === "court" ? "Court" : "Registry"}
            {forum.state ? ` · ${forum.state}` : " · Federal"}
          </p>
          {forum.profile ? (
            <p className="text-sm">{describeProfile(forum.profile)}</p>
          ) : (
            <p className="text-sm text-warning">
              The formatting profile has problems: {forum.issues.join("; ")}
            </p>
          )}
          {forum.profile && (
            <p className="text-sm text-muted break-words">
              Source: {forum.profile.source}
            </p>
          )}
          <DraftingStatusBar
            kind="forum"
            id={forum.id}
            name={forum.name}
            status={forum.status}
            isAdmin={isAdmin}
          />
        </li>
      ))}
    </ul>
  );
}

export function describeProfile(p: ForumProfile): string {
  const m = p.marginsMm;
  const margins =
    m.top === m.right && m.right === m.bottom && m.bottom === m.left
      ? `${m.top} mm margins`
      : `margins ${m.top}/${m.right}/${m.bottom}/${m.left} mm`;
  return `${p.paper}, ${p.font} ${p.fontSizePt} pt, ${p.lineSpacing} line spacing, ${margins}, ${PAGE_NUMBERS[p.pageNumbers]}, ${
    p.coverPage ? "cover page" : "no cover page"
  }, ${SIGNER[p.signatureBlock]}.`;
}
