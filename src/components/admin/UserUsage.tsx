import { formatNaira, formatUsd, usageKindLabel } from "@/lib/adminUsage";
import { formatWat } from "@/lib/dates";
import type { PersonUsage } from "@/server/db/adminUsage";
import { DailyCostChart } from "./DailyCostChart";

const th = "px-3 py-2 font-medium";
const td = "px-3 py-2 whitespace-nowrap";

function Money({ usd }: { usd: number }) {
  return (
    <>
      {formatUsd(usd)} <span className="text-muted">({formatNaira(usd)})</span>
    </>
  );
}

function Total({ label, usd, note }: { label: string; usd: number; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl">{formatUsd(usd)}</span>
      <span className="text-sm text-muted">
        {formatNaira(usd)}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

// Admin: what one person costs and what they study (founder, 2026-10-30). Costs come from the
// record of every AI call; courses from counts of their chats. Never the text of their questions.
export function UserUsage({ usage }: { usage: PersonUsage }) {
  const sum = (pick: (k: PersonUsage["kinds"][number]) => number) => usage.kinds.reduce((total, k) => total + pick(k), 0);
  const month = sum((k) => k.costMonth);
  const days30 = sum((k) => k.cost30d);
  const ever = sum((k) => k.costTotal);
  const activeDays = usage.daily.filter((d) => d.calls > 0).length;

  return (
    <section aria-labelledby="usage-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="usage-heading" className="text-lg font-medium">Usage and cost</h2>
        <p className="text-sm text-muted">
          What this person&apos;s use of Lawdeck has cost in AI (Claude answers and Azure voice), from the record of every call. Naira at ₦1,400 to the
          dollar. Counts only: the text of their questions stays private.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Total label="This month" usd={month} />
        <Total label="Last 30 days" usd={days30} note={`active on ${activeDays} of 30 days`} />
        <Total label="Since joining" usd={ever} />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-line px-4 py-3">
        <h3 className="text-base font-medium">Cost per day, last 30 days</h3>
        <DailyCostChart days={usage.daily} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-medium">By feature</h3>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Uses and cost by feature</caption>
            <thead className="bg-surface text-muted">
              <tr>
                <th scope="col" className={th}>Feature</th>
                <th scope="col" className={th}>This month</th>
                <th scope="col" className={th}>Last 30 days</th>
                <th scope="col" className={th}>Since joining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {usage.kinds.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    No AI use yet.
                  </td>
                </tr>
              ) : (
                usage.kinds.map((k) => (
                  <tr key={k.kind}>
                    <th scope="row" className="px-3 py-2 font-normal">{usageKindLabel(k.kind)}</th>
                    <td className={td}>{k.callsMonth} · <Money usd={k.costMonth} /></td>
                    <td className={td}>{k.calls30d} · <Money usd={k.cost30d} /></td>
                    <td className={td}>{k.callsTotal} · <Money usd={k.costTotal} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-medium">What they study</h3>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="sr-only">Chats and questions per course</caption>
            <thead className="bg-surface text-muted">
              <tr>
                <th scope="col" className={th}>Course</th>
                <th scope="col" className={th}>Questions</th>
                <th scope="col" className={th}>Chats</th>
                <th scope="col" className={th}>Last asked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {usage.courses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    No chats yet.
                  </td>
                </tr>
              ) : (
                usage.courses.map((c) => (
                  <tr key={c.course}>
                    <th scope="row" className="px-3 py-2 font-normal">{c.course}</th>
                    <td className={td}>{c.questions}</td>
                    <td className={td}>{c.chats}</td>
                    <td className={td}>{c.lastAskedAt ? formatWat(c.lastAskedAt) : "–"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
