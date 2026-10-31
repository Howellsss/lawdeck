import Link from "next/link";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { PAYMENT_FILTER_LABELS, USER_SORT_LABELS } from "@/lib/adminUsers";
import { PAYMENT_FILTERS, USER_SORTS, type UserFilter } from "@/schemas/adminUsers";

const field = "h-11 rounded-full border border-line bg-sidebar px-4 text-[15px] text-ink";

// Search, filters and order for the people list. A plain form that changes the page address, so it
// works without JavaScript and a filtered list can be bookmarked.
export function UserFilters({ filter, planNames }: { filter: UserFilter; planNames: string[] }) {
  const filtered = Boolean(filter.q || filter.plan || filter.payment || filter.sort !== "newest");
  return (
    <form action="/admin/users" method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor="users-q" className="px-1 text-sm font-medium">Search</label>
        <input id="users-q" name="q" type="search" defaultValue={filter.q ?? ""} maxLength={100} placeholder="Email or name" className={`${field} placeholder:text-muted`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="users-plan" className="px-1 text-sm font-medium">Plan</label>
        <select id="users-plan" name="plan" defaultValue={filter.plan ?? ""} className={field}>
          <option value="">All plans</option>
          {planNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="users-payment" className="px-1 text-sm font-medium">Payment</label>
        <select id="users-payment" name="payment" defaultValue={filter.payment ?? ""} className={field}>
          <option value="">Anyone</option>
          {PAYMENT_FILTERS.map((value) => (
            <option key={value} value={value}>{PAYMENT_FILTER_LABELS[value]}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="users-sort" className="px-1 text-sm font-medium">Order</label>
        <select id="users-sort" name="sort" defaultValue={filter.sort} className={field}>
          {USER_SORTS.map((value) => (
            <option key={value} value={value}>{USER_SORT_LABELS[value]}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className={compactPrimaryButton}>Show</button>
        {filtered && <Link href="/admin/users" className="text-sm">Clear</Link>}
      </div>
    </form>
  );
}
