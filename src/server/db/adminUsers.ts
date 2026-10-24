import "server-only";
import type { PaymentStatus } from "@/lib/adminUsers";
import { USERS_PAGE_SIZE, type UserFilter } from "@/schemas/adminUsers";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Reads for the admin Users dashboard (migration 34). Every read checks the admin role here, and
// the database functions check it again. Logs error codes only, never emails (rule I-03).

export type UsersOverview = {
  counts: Record<string, number>;
  plans: { name: string; students: number }[];
  signups: { day: string; signups: number }[];
};

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "student" | "reviewer" | "admin";
  joinedAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  signInMethod: string;
  plan: string;
  payment: PaymentStatus;
  paidUntil: string | null;
  pilotAccess: boolean;
  questionsThisMonth: number;
  lastActiveAt: string | null;
};

export type UsersPage = { rows: UserRow[]; total: number; page: number; pages: number; planNames: string[] };

// The headline counts, students per plan and the 30-day sign-ups chart, or null for non-admins.
export async function getUsersOverview(): Promise<UsersOverview | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const [overview, signups] = await Promise.all([supabase.rpc("admin_overview"), supabase.rpc("admin_signups_by_day", { days: 30 })]);
  const failed = overview.error ?? signups.error;
  if (failed) {
    console.error("users overview failed", { code: failed.code });
    throw new Error("The dashboard could not be loaded.");
  }
  const counts: Record<string, number> = {};
  const plans: UsersOverview["plans"] = [];
  for (const row of overview.data ?? []) {
    if (row.metric.startsWith("plan:")) plans.push({ name: row.metric.slice(5), students: Number(row.value) });
    else counts[row.metric] = Number(row.value);
  }
  plans.sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
  return { counts, plans, signups: (signups.data ?? []).map((row) => ({ day: row.day, signups: Number(row.signups) })) };
}

// One page of people, newest first, or null for non-admins.
export async function listUsers(filter: UserFilter): Promise<UsersPage | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const [people, plans] = await Promise.all([
    supabase.rpc("admin_users", {
      search: filter.q,
      plan_name: filter.plan,
      payment: filter.payment,
      page_size: USERS_PAGE_SIZE,
      page_offset: (filter.page - 1) * USERS_PAGE_SIZE,
    }),
    supabase.from("plans").select("name").order("name"),
  ]);
  const failed = people.error ?? plans.error;
  if (failed) {
    console.error("users list failed", { code: failed.code });
    throw new Error("The people list could not be loaded.");
  }
  const data = people.data ?? [];
  const total = data.length ? Number(data[0].total_count) : 0;
  const planNames = (plans.data ?? []).map((plan) => plan.name);
  return {
    rows: data.map((row) => ({
      id: row.id,
      email: row.email ?? "",
      name: row.full_name?.trim() || null,
      role: row.role,
      joinedAt: row.joined_at,
      lastSignInAt: row.last_sign_in_at,
      emailConfirmed: row.email_confirmed,
      signInMethod: row.sign_in_method,
      plan: row.plan,
      payment: row.payment_status,
      paidUntil: row.paid_until,
      pilotAccess: row.pilot_access,
      questionsThisMonth: Number(row.questions_this_month),
      lastActiveAt: row.last_active_at,
    })),
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    planNames: planNames.includes("Free") ? planNames : ["Free", ...planNames],
  };
}

export type UserDetail = Record<string, string | null>;

// One person's account and usage counts; "missing" when there is no such person, null for non-admins.
export async function getUserDetail(id: string): Promise<UserDetail | "missing" | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_user_detail", { person: id });
  if (error) {
    console.error("user detail failed", { code: error.code });
    throw new Error("This person's details could not be loaded.");
  }
  if (!data?.length) return "missing";
  return Object.fromEntries(data.map((row) => [row.metric, row.value]));
}
