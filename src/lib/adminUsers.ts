import type { PaymentFilter, UserFilter, UserSort } from "@/schemas/adminUsers";

// Words shown on the admin Users dashboard (migration 34).

export type PaymentStatus = "paid" | "past_due" | "lapsed" | "never";

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  past_due: "Payment failed",
  lapsed: "Lapsed",
  never: "Not paid",
};

export const PAYMENT_FILTER_LABELS: Record<PaymentFilter, string> = {
  paid: "Paid",
  unpaid: "Not paid",
  past_due: "Payment failed",
};

export function signInMethodLabel(method: string): string {
  if (method === "google") return "Google";
  if (method === "email") return "Email";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

// The address of the Users page with these filters; empty filters and page 1 are left out.
export function usersHref(filter: Partial<UserFilter>): string {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.plan) params.set("plan", filter.plan);
  if (filter.payment) params.set("payment", filter.payment);
  if (filter.sort && filter.sort !== "newest") params.set("sort", filter.sort);
  if (filter.page && filter.page > 1) params.set("page", String(filter.page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

// "3 minutes ago", "Yesterday", "5 days ago"; older dates are shown in full by the caller.
export function timeAgo(value: string | null, now: Date = new Date()): string | null {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return null;
}

export const USER_SORT_LABELS: Record<UserSort, string> = {
  newest: "Newest first",
  cost: "Highest AI cost this month",
  questions: "Most questions this month",
  active: "Most recently active",
};
