import type { LessonSource } from "@/schemas/lesson";
import type { StudyAuthority } from "@/server/db/study";

// An authority's card (founder's brief, 32): citation, court, facts, issue, decision and principle,
// as far as the library gives them, and where it comes from in the library. Facts the library does
// not give are never filled in.
export function AuthorityCard({ authority, sources }: { authority: StudyAuthority; sources: LessonSource[] }) {
  const from = authority.sources
    .map((label) => sources.find((s) => s.label === label))
    .filter((s) => s !== undefined);
  const row = (label: string, value: string | null) =>
    value ? (
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs uppercase tracking-[0.12em] text-muted">{label}</dt>
        <dd className="text-[15px] leading-relaxed">{value}</dd>
      </div>
    ) : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[17px] font-medium">{authority.kind === "case" ? <i>{authority.name}</i> : authority.name}</p>
        {authority.citation && <p className="text-sm text-muted">{authority.citation}</p>}
      </div>
      <dl className="flex flex-col gap-3">
        {row("Court", authority.court)}
        {authority.kind === "case" &&
          (authority.factsFromLibrary && authority.facts ? (
            row("Facts", authority.facts)
          ) : (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-[0.12em] text-muted">Facts</dt>
              <dd className="text-sm text-warning">Not in the Lawdeck library: verification required.</dd>
            </div>
          ))}
        {row("Issue", authority.issue)}
        {row("Decision", authority.decision)}
        {row("Principle", authority.principle)}
      </dl>
      {from.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">From the library</p>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {from.map((s) => (
              <li key={s.label}>
                {s.title}
                {s.heading ? ` · ${s.heading}` : ""}
                {s.pages ? ` · ${s.pages}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
