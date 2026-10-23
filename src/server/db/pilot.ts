import "server-only";
import { getStaffRole } from "@/server/auth/roles";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Reads for the closed pilot (Phase 8, migration 32). Logs error codes only (rule I-03).

export type PilotStatus = {
  inviteOnly: boolean;
  hasAccess: boolean;
  // The price question to show, or null when it is closed or already answered.
  priceQuestion: { priceNgn: number } | null;
};

export async function getPilotStatus(): Promise<PilotStatus | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const supabase = await createSupabaseServerClient();
  const [settings, access] = await Promise.all([
    supabase.from("pilot_settings").select("invite_only, price_ngn, price_question_open").eq("id", true).maybeSingle(),
    supabase.rpc("has_pilot_access"),
  ]);
  if (settings.error || access.error || !settings.data) {
    console.error("pilot status failed", { code: settings.error?.code ?? access.error?.code ?? "no_row" });
    return null;
  }
  const { invite_only, price_ngn, price_question_open } = settings.data;
  let priceQuestion: PilotStatus["priceQuestion"] = null;
  if (price_question_open && price_ngn && access.data) {
    const answered = await supabase.from("price_answers").select("price_ngn").eq("price_ngn", price_ngn).maybeSingle();
    if (!answered.error && !answered.data) priceQuestion = { priceNgn: price_ngn };
  }
  return { inviteOnly: invite_only, hasAccess: access.data === true, priceQuestion };
}

export type InviteCodeRow = {
  id: string;
  code: string;
  label: string;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  disabled: boolean;
  createdAt: string;
};

export type PilotDashboard = {
  settings: { inviteOnly: boolean; priceNgn: number | null; priceQuestionOpen: boolean };
  codes: InviteCodeRow[];
  // Weekly counts, newest week first: one row per week with each metric.
  weeks: { weekStart: string; counts: Record<string, number> }[];
  summary: Record<string, number | null>;
  openReports: number;
};

// Everything for the admin's pilot page, or null for anyone who is not an admin.
export async function getPilotDashboard(): Promise<PilotDashboard | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const [settings, codes, metrics, summary, reports] = await Promise.all([
    supabase.from("pilot_settings").select("invite_only, price_ngn, price_question_open").eq("id", true).maybeSingle(),
    supabase.from("invite_codes").select("id, code, label, max_uses, uses, expires_at, disabled, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.rpc("pilot_metrics", { weeks: 6 }),
    supabase.rpc("pilot_summary"),
    supabase.from("problem_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const failed = [settings, codes, metrics, summary, reports].find((result) => result.error);
  if (failed?.error || !settings.data) {
    console.error("pilot dashboard failed", { code: failed?.error?.code ?? "no_settings" });
    throw new Error("The pilot page could not be loaded.");
  }
  const byWeek = new Map<string, Record<string, number>>();
  for (const row of metrics.data ?? []) {
    const counts = byWeek.get(row.week_start) ?? {};
    counts[row.metric] = Number(row.value);
    byWeek.set(row.week_start, counts);
  }
  return {
    settings: { inviteOnly: settings.data.invite_only, priceNgn: settings.data.price_ngn, priceQuestionOpen: settings.data.price_question_open },
    codes: (codes.data ?? []).map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      maxUses: c.max_uses,
      uses: c.uses,
      expiresAt: c.expires_at,
      disabled: c.disabled,
      createdAt: c.created_at,
    })),
    weeks: [...byWeek.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([weekStart, counts]) => ({ weekStart, counts })),
    summary: Object.fromEntries((summary.data ?? []).map((row) => [row.metric, row.value === null ? null : Number(row.value)])),
    openReports: reports.count ?? 0,
  };
}
