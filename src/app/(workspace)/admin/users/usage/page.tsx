import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UsageRankingTable } from "@/components/admin/UsageRankingTable";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatNaira, formatUsd } from "@/lib/adminUsage";
import { USAGE_PERIODS, usagePeriodSchema } from "@/schemas/adminUsage";
import { getUsageRanking } from "@/server/db/adminUsage";

export const metadata: Metadata = { title: "Usage and cost · Lawdeck" };

// Admin: who uses Lawdeck most and what it costs, per person (founder, 2026-10-30; migration 41).
// Admins only; everyone else gets "page not found". Costs and counts only, never question text.
export default function UsagePage({ searchParams }: PageProps<"/admin/users/usage">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading usage" />}>
        <Usage searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Usage({ searchParams }: Pick<PageProps<"/admin/users/usage">, "searchParams">) {
  const { days } = usagePeriodSchema.parse(await searchParams);
  const rows = await getUsageRanking(days);
  if (!rows) notFound();
  // Time is read once per request for "3 minutes ago".
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now());
  const total = rows.reduce((sum, row) => sum + row.costUsd, 0);
  const questions = rows.reduce((sum, row) => sum + row.questions, 0);
  const students = rows.filter((row) => row.role === "student");
  const studentCost = students.reduce((sum, row) => sum + row.costUsd, 0);

  return (
    <>
      <Link href="/admin/users" className="text-sm">
        All users
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Usage and cost</h1>
        <p className="text-muted">
          What each person&apos;s use of Lawdeck costs in AI (Claude answers and Azure voice), highest first. Open a name for their cost by feature, by
          day and by course. Naira at ₦1,400 to the dollar.
        </p>
      </div>
      <nav aria-label="Period" className="flex flex-wrap gap-2">
        {USAGE_PERIODS.map((period) => (
          <Link
            key={period}
            href={`/admin/users/usage?days=${period}`}
            aria-current={period === days ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm no-underline ${period === days ? "border-ink bg-ink text-on-ink" : "border-line text-ink hover:bg-pill"}`}
          >
            Last {period} days
          </Link>
        ))}
      </nav>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-line px-4 py-3">
          <dt className="text-sm text-muted">Total AI cost</dt>
          <dd className="text-2xl">{formatUsd(total)}</dd>
          <dd className="text-sm text-muted">{formatNaira(total)}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line px-4 py-3">
          <dt className="text-sm text-muted">Average per active student</dt>
          <dd className="text-2xl">{students.length ? formatUsd(studentCost / students.length) : "–"}</dd>
          <dd className="text-sm text-muted">
            {students.length ? `${formatNaira(studentCost / students.length)} · ${students.length} active` : "No active students"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line px-4 py-3">
          <dt className="text-sm text-muted">Average cost per question</dt>
          <dd className="text-2xl">{questions ? formatUsd(total / questions) : "–"}</dd>
          <dd className="text-sm text-muted">{questions.toLocaleString("en-NG")} questions</dd>
        </div>
      </dl>
      <UsageRankingTable rows={rows} now={now} days={days} />
    </>
  );
}
