import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserFilters } from "@/components/admin/UserFilters";
import { UsersOverview } from "@/components/admin/UsersOverview";
import { UserTable } from "@/components/admin/UserTable";
import { Pager } from "@/components/library/Pager";
import { PilotMeasures } from "@/components/pilot/PilotMeasures";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { USER_SORT_LABELS, usersHref } from "@/lib/adminUsers";
import { formatNaira, formatUsd } from "@/lib/adminUsage";
import { userFilterSchema } from "@/schemas/adminUsers";
import { getUsageRanking } from "@/server/db/adminUsage";
import { getUsersOverview, listUsers } from "@/server/db/adminUsers";
import { getInviteOnly, getPilotDashboard } from "@/server/db/pilot";

export const metadata: Metadata = { title: "Users · Lawdeck" };

// The one admin dashboard for students (founder, 2026-10-31: "everything in one place, not
// scattered"): sign-ups, plans and payment, AI cost, the pilot's weekly measures, then everyone in
// one table (paid or free, joined, questions, cost, last active). Names open the full profile.
// Admins only; everyone else gets "page not found".
export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the dashboard" />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function CostCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl">{value}</span>
      <span className="text-sm text-muted">{note}</span>
    </div>
  );
}

async function Users({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const filter = userFilterSchema.parse(await searchParams);
  const [overview, people, inviteOnly, usage, pilot] = await Promise.all([
    getUsersOverview(),
    listUsers(filter),
    getInviteOnly(),
    getUsageRanking(30),
    getPilotDashboard(),
  ]);
  if (!overview || !people || !usage || !pilot) notFound();
  // Time is read once per request for "3 minutes ago".
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now());
  const filtered = Boolean(filter.q || filter.plan || filter.payment);
  const noPayments = !overview.counts.paying && !overview.counts.past_due;
  const cost = usage.reduce((sum, row) => sum + row.costUsd, 0);
  const questions = usage.reduce((sum, row) => sum + row.questions, 0);
  const students = usage.filter((row) => row.role === "student");
  const studentCost = students.reduce((sum, row) => sum + row.costUsd, 0);
  const top = students[0];

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Users</h1>
        <p className="text-muted">Everything about Lawdeck&apos;s students in one place: who joined, paid or free, how much they use it and what it costs.</p>
      </div>

      <UsersOverview data={overview} />

      <section aria-labelledby="cost-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="cost-heading" className="text-lg font-medium">AI cost, last 30 days</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CostCard label="Total" value={formatUsd(cost)} note={`${formatNaira(cost)} · Claude answers and Azure voice`} />
          <CostCard
            label="Average per active student"
            value={students.length ? formatUsd(studentCost / students.length) : "–"}
            note={students.length ? `${formatNaira(studentCost / students.length)} · ${students.length} active` : "No active students yet"}
          />
          <CostCard label="Average per question" value={questions ? formatUsd(cost / questions) : "–"} note={`${questions.toLocaleString("en-NG")} questions`} />
          <CostCard
            label="Highest-cost student"
            value={top ? formatUsd(top.costUsd) : "–"}
            note={top ? `${top.name ?? top.email}` : "No active students yet"}
          />
        </div>
      </section>

      <section aria-labelledby="pilot-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="pilot-heading" className="text-lg font-medium">Pilot: this week and the last 6 weeks</h2>
        <PilotMeasures data={pilot} />
      </section>

      <section aria-labelledby="people-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="people-heading" className="text-lg font-medium">
          {filtered ? "Matching people" : "Everyone"}, {USER_SORT_LABELS[filter.sort].toLowerCase()} ({people.total.toLocaleString("en-NG")})
        </h2>
        <p className="text-sm">
          {inviteOnly
            ? "Invite only is on: new people wait until you press Give access (or they enter an invite code)."
            : "Invite only is off, so everyone who signs up can use Lawdeck. Switch it on to choose who gets in."}{" "}
          <Link href="/admin/pilot">Pilot tools: invites, emails and limits</Link>
        </p>
        <UserFilters filter={filter} planNames={people.planNames} />
        {noPayments && (
          <p className="text-sm text-muted">No payments are recorded yet, so everyone shows as “Not paid”. They will appear here once the payment provider is connected.</p>
        )}
        <UserTable rows={people.rows} now={now} filtered={filtered} />
        <Pager page={people.page} pages={people.pages} hrefFor={(page) => usersHref({ ...filter, page })} label="People pages" />
      </section>
    </>
  );
}
