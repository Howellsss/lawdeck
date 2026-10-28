import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserFilters } from "@/components/admin/UserFilters";
import { UsersOverview } from "@/components/admin/UsersOverview";
import { UserTable } from "@/components/admin/UserTable";
import { Pager } from "@/components/library/Pager";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { usersHref } from "@/lib/adminUsers";
import { userFilterSchema } from "@/schemas/adminUsers";
import Link from "next/link";
import { getUsersOverview, listUsers } from "@/server/db/adminUsers";
import { getInviteOnly } from "@/server/db/pilot";

export const metadata: Metadata = { title: "Users · Lawdeck" };

// The admin Users dashboard (migration 34): who just joined, their plan, whether they pay and how
// much they use Lawdeck. Admins only; everyone else gets "page not found".
export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the dashboard" />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Users({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const filter = userFilterSchema.parse(await searchParams);
  const [overview, people, inviteOnly] = await Promise.all([getUsersOverview(), listUsers(filter), getInviteOnly()]);
  if (!overview || !people) notFound();
  // Time is read once per request for "3 minutes ago".
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now());
  const filtered = Boolean(filter.q || filter.plan || filter.payment);
  const noPayments = !overview.counts.paying && !overview.counts.past_due;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Users</h1>
        <p className="text-muted">Who is joining, what plan they are on, whether they pay, and who is using Lawdeck.</p>
      </div>
      <UsersOverview data={overview} />
      <section aria-labelledby="people-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="people-heading" className="text-lg font-medium">
          {filtered ? "Matching people" : "Everyone, newest first"} ({people.total.toLocaleString("en-NG")})
        </h2>
        <p className="text-sm">
          {inviteOnly
            ? "Invite only is on: new people wait until you press Give access (or they enter an invite code)."
            : "Invite only is off, so everyone who signs up can use Lawdeck. Switch it on to choose who gets in."}{" "}
          <Link href="/admin/pilot">Pilot settings and limits</Link>
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
