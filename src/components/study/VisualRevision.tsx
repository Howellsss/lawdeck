"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRightPanel } from "@/components/shell/panelContext";
import { placeAnnotation, type Annotation, type Placed } from "@/lib/annotations";
import { REVISION_FILTERS, revisionItems, type RevisionFilter, type RevisionItem } from "@/lib/visualRevision";
import type { LessonContent } from "@/schemas/lesson";
import type { StudyAuthority } from "@/server/db/study";
import { AuthorityCard } from "./AuthorityCard";

const NAMES: Record<RevisionFilter, string> = {
  case: "Cases",
  statute: "Statutes",
  principle: "Principles",
  definition: "Definitions",
  tip: "Exam tips",
  exception: "Exceptions",
  mine: "My marks",
};
const ONE: Record<RevisionFilter, string> = {
  case: "Case",
  statute: "Statute",
  principle: "Principle",
  definition: "Definition",
  tip: "Exam tip",
  exception: "Exception",
  mine: "My mark",
};

// Visual Revision Mode (founder's brief, section 31; Phase 3b): every marked point of a topic, each in
// its own sentence, with filters. Case and statute names open their card; "Read it in the lesson"
// opens the lesson at that section. No AI, so it costs nothing.
export function VisualRevision({
  topicId,
  content,
  annotations,
  authorities,
}: {
  topicId: string;
  content: LessonContent;
  annotations: Annotation[];
  authorities: StudyAuthority[];
}) {
  const panel = useRightPanel();
  const [shown, setShown] = useState<Set<RevisionFilter>>(new Set(REVISION_FILTERS));
  const items = useMemo(() => {
    const placed = annotations.map((a) => placeAnnotation(a, content)).filter((a): a is Placed => a !== null);
    return revisionItems(content, placed);
  }, [annotations, content]);
  const count = (f: RevisionFilter) => items.filter((i) => i.kind === f).length;
  const visible = items.filter((i) => shown.has(i.kind));

  const toggle = (f: RevisionFilter) =>
    setShown((current) => {
      const next = new Set(current);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  const only = (f: RevisionFilter) => setShown(new Set([f]));

  const openCard = (key: string) => {
    const authority = authorities.find((a) => a.key === key);
    if (authority) panel.open({ title: authority.kind === "case" ? "Case" : "Statute", body: <AuthorityCard authority={authority} sources={content.sources} /> });
  };

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted">Show (tap a name to show only that kind)</legend>
        <div className="flex flex-wrap gap-2">
          {REVISION_FILTERS.map((f) => (
            <span key={f} className="inline-flex items-center overflow-hidden rounded-full border border-line text-sm">
              <label className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5">
                <input type="checkbox" checked={shown.has(f)} onChange={() => toggle(f)} className="size-4" />
                {NAMES[f]} ({count(f)})
              </label>
              <button type="button" onClick={() => only(f)} className="border-l border-line px-2 py-1.5 text-muted underline underline-offset-2" aria-label={`Show only ${NAMES[f].toLowerCase()}`}>
                only
              </button>
            </span>
          ))}
        </div>
      </fieldset>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          Nothing to show with these filters. {count("mine") === 0 && "Your own marks appear here once you mark words in the lesson."}
        </p>
      ) : (
        <ol aria-label="Points to revise" data-highlights="full" className="flex flex-col gap-3">
          {visible.map((item) => (
            <Point key={item.key} item={item} topicId={topicId} heading={content.sections[item.section]?.heading ?? ""} onAuthority={openCard} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Point({ item, topicId, heading, onAuthority }: { item: RevisionItem; topicId: string; heading: string; onAuthority: (key: string) => void }) {
  const before = item.sentence.slice(0, item.start);
  const phrase = item.sentence.slice(item.start, item.end);
  const after = item.sentence.slice(item.end);
  const look = item.kind === "mine" ? `ann ann-${item.style ?? "highlight"}` : `mark mark-${item.kind}`;
  return (
    <li className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">
        {ONE[item.kind]} · {heading}
      </p>
      <p className="text-[16px] leading-[1.8]">
        {before}
        {item.authority ? (
          <button type="button" onClick={() => onAuthority(item.authority!)} className={`${look} cursor-pointer underline decoration-dotted underline-offset-4`}>
            {item.kind === "case" ? <i>{phrase}</i> : phrase}
          </button>
        ) : (
          <span className={look}>{phrase}</span>
        )}
        {after}
      </p>
      {item.note && <p className="text-sm text-muted">Your note: {item.note}</p>}
      <Link href={`/study/${topicId}#lesson-section-${item.section}`} className="self-start text-sm">
        Read it in the lesson
      </Link>
    </li>
  );
}
