import Link from "next/link";
import type { ReactNode } from "react";
import { POLICY_CONTACT_EMAIL, type Policy, type PolicyBlock } from "@/templates/policies/types";

// Words in the policy text that become links. Only these fixed words are linked; the text itself
// is plain data, never HTML.
const LINKS: [string, (text: string) => ReactNode][] = [
  [POLICY_CONTACT_EMAIL, (t) => <a href={`mailto:${t}`}>{t}</a>],
  ["mylawdeck.com/takedown", (t) => <Link href="/takedown">{t}</Link>],
  ["ndpc.gov.ng", (t) => <a href="https://ndpc.gov.ng" rel="noopener noreferrer" target="_blank">{t}</a>],
  ["Privacy Notice", (t) => <Link href="/privacy">{t}</Link>],
  ["Terms of Service", (t) => <Link href="/terms">{t}</Link>],
];

function linked(text: string, self: string): ReactNode[] {
  const active = LINKS.filter(([word]) => word !== self);
  const pattern = new RegExp(`(${active.map(([w]) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(pattern).map((part, i) => {
    const link = active.find(([word]) => word === part);
    return link ? <span key={i}>{link[1](part)}</span> : part;
  });
}

function Block({ block, self }: { block: PolicyBlock; self: string }) {
  if (typeof block === "string") return <p>{linked(block, self)}</p>;
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {block.list.map((item, i) => (
        <li key={i}>{linked(item, self)}</li>
      ))}
    </ul>
  );
}

const shown = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// One page for each of Lawdeck's policies: title, last-updated date, a list of sections, then the
// sections themselves. Public: anyone can read it, signed in or not.
export function PolicyPage({ policy }: { policy: Policy }) {
  return (
    <article className="flex flex-col gap-8 text-[15.5px] leading-relaxed">
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-[34px] leading-tight">{policy.title}</h1>
        <p className="text-[14px] text-muted">Last updated {shown(policy.updated)}</p>
        {policy.intro.map((p, i) => (
          <p key={i}>{linked(p, policy.title)}</p>
        ))}
      </header>
      <nav aria-label="Sections" className="rounded-xl border border-line px-4 py-3">
        <p className="mb-1 text-[13px] font-medium text-muted">On this page</p>
        <ol className="flex flex-col gap-1 text-[14px]">
          {policy.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.heading}</a>
            </li>
          ))}
        </ol>
      </nav>
      {policy.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-6 flex-col gap-3">
          <h2 id={`${s.id}-h`} className="font-serif text-[22px] leading-snug">
            {s.heading}
          </h2>
          {s.blocks.map((b, i) => (
            <Block key={i} block={b} self={policy.title} />
          ))}
        </section>
      ))}
    </article>
  );
}
