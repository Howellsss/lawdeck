import type { ReactNode } from "react";

export type AidView = {
  kind: "acronym" | "phrase" | "association" | "pattern";
  title: string;
  device: string;
  items: { key: string; meaning: string }[];
  explanation: string | null;
};

export const AID_KIND_LABELS = { acronym: "Acronym", phrase: "Memory phrase", association: "Word association", pattern: "Grouping" } as const;

// One memory aid (docs/specs/remembrance.md, Phase 2): what it helps remember, the device, and what
// every letter, word or group stands for. Used by reviewers and, in step 2b, by students.
// "Made for you" marks one made on request (Phase 2c), checked against the library but not reviewed.
export function MemoryAidCard({ aid, actions, madeForYou = false }: { aid: AidView; actions?: ReactNode; madeForYou?: boolean }) {
  return (
    <section
      aria-label={`${madeForYou ? "Memory aid made for you" : "Memory aid"}: ${aid.title}`}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">
          {madeForYou ? "Made for you · " : ""}
          {AID_KIND_LABELS[aid.kind]} · {aid.title}
        </p>
        {actions}
      </div>
      <p className={aid.kind === "acronym" ? "font-serif text-3xl tracking-[0.2em]" : "font-serif text-xl"}>{aid.device}</p>
      {aid.items.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
          {aid.items.map((item, i) => (
            <div key={i} className="contents">
              <dt className="font-medium">{item.key}</dt>
              <dd>{item.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
      {aid.explanation && <p className="text-sm text-muted">{aid.explanation}</p>}
    </section>
  );
}
