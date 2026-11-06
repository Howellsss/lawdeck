"use client";

import { Icon } from "@/components/ui/Icon";
import type { ChatPerson } from "@/server/chat/data";

// Suggestions while typing @name: chat members only, never an email address.
export function MentionList({ people, active, onPick }: { people: ChatPerson[]; active: number; onPick: (p: ChatPerson) => void }) {
  return (
    <ul role="listbox" aria-label="People to mention" className="absolute bottom-full left-4 z-20 mb-1 w-72 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lg lg:left-6">
      {people.map((p, i) => (
        <li key={p.id} role="option" aria-selected={i === active}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(p)}
            className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[14px] ${i === active ? "bg-pill" : ""}`}
          >
            <span className="font-medium">{p.name}</span>
            {p.campus && <span className="text-[12px] text-muted">{p.campus}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Under the text: the links added with "Add link", showing where each set of words points.
export function LinkNote({ links }: { links: { label: string; href: string }[] }) {
  if (links.length === 0) return null;
  return (
    <p aria-label="Links in this message" className="flex flex-wrap gap-x-3 px-3 pb-1 text-[12px] text-muted">
      {links.map((l) => (
        <span key={l.label} className="flex min-w-0 items-center gap-1">
          <Icon name="link" size={12} />
          <span className="font-medium text-ink underline underline-offset-2">{l.label}</span>
          <span aria-hidden>→</span>
          <span className="max-w-[12rem] truncate">{l.href}</span>
        </span>
      ))}
    </p>
  );
}
