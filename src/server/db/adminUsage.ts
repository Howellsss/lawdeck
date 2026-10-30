import "server-only";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Usage and cost per person for admins (migration 41). Every read checks the admin role here, and
// the database functions check it again. Counts and costs only: never question or answer text.

export type UsageRankRow = {
  id: string;
  email: string;
  name: string | null;
  role: "student" | "reviewer" | "admin";
  calls: number;
  questions: number;
  costUsd: number;
  lastActiveAt: string | null;
};

export type KindUsage = {
  kind: string;
  callsMonth: number;
  costMonth: number;
  calls30d: number;
  cost30d: number;
  callsTotal: number;
  costTotal: number;
};

export type PersonUsage = {
  kinds: KindUsage[];
  daily: { day: string; calls: number; costUsd: number }[];
  courses: { course: string; chats: number; questions: number; lastAskedAt: string | null }[];
};

function failed(step: string, code: string | undefined): never {
  console.error("admin usage failed", { step, code: code ?? "unknown" });
  throw new Error("Usage could not be loaded.");
}

// Everyone who used Lawdeck in the last `days` days, highest cost first; null for non-admins.
export async function getUsageRanking(days: number): Promise<UsageRankRow[] | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_usage_ranking", { days });
  if (error) failed("ranking", error.code);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.full_name,
    role: row.role,
    calls: row.calls,
    questions: row.questions,
    costUsd: Number(row.cost_usd),
    lastActiveAt: row.last_active_at,
  }));
}

// One person's use by kind, cost per day for 30 days, and questions per course; null for non-admins.
export async function getPersonUsage(person: string): Promise<PersonUsage | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const [kinds, daily, courses] = await Promise.all([
    supabase.rpc("admin_user_usage", { person }),
    supabase.rpc("admin_user_usage_daily", { person, days: 30 }),
    supabase.rpc("admin_user_courses", { person }),
  ]);
  if (kinds.error) failed("kinds", kinds.error.code);
  if (daily.error) failed("daily", daily.error.code);
  if (courses.error) failed("courses", courses.error.code);
  return {
    kinds: (kinds.data ?? []).map((row) => ({
      kind: row.kind,
      callsMonth: row.calls_month,
      costMonth: Number(row.cost_month),
      calls30d: row.calls_30d,
      cost30d: Number(row.cost_30d),
      callsTotal: row.calls_total,
      costTotal: Number(row.cost_total),
    })),
    daily: (daily.data ?? []).map((row) => ({ day: row.day, calls: row.calls, costUsd: Number(row.cost_usd) })),
    courses: (courses.data ?? []).map((row) => ({
      course: row.course,
      chats: row.chats,
      questions: row.questions,
      lastAskedAt: row.last_asked_at,
    })),
  };
}
