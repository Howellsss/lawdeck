"use server";

import { refresh } from "next/cache";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { generateInviteCode } from "@/lib/inviteCode";
import { inviteCodeSchema, inviteIdSchema, newInviteSchema, pilotSettingsSchema, priceAnswerSchema } from "@/schemas/pilot";
import { getStaffRole } from "@/server/auth/roles";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// The closed pilot (Phase 8, migration 32). Students redeem invite codes and answer the price
// question; admins change the pilot settings and manage codes. Every action checks sign-in or
// the admin role here, and the database checks again (row-level security).

export type PilotResult = { ok: true; message?: string } | { ok: false; message: string; fieldErrors?: FieldErrors };

const SIGNED_OUT = "Please sign in again, then try once more.";
const NOT_ADMIN = "Only admins can change the pilot.";
const NOT_SAVED = "That wasn’t saved. Please try again.";

// Logs the action and error code only (rule I-03).
function logFailure(action: string, code: string | undefined) {
  console.error("pilot action failed", { action, code: code ?? "unknown" });
}

const REDEEM_MESSAGES = {
  ok: "Welcome to the Lawdeck pilot. You can start asking questions now.",
  already: "Your account already has pilot access.",
  invalid: "That code doesn’t work. Check it, or ask whoever invited you for a new one.",
  used_up: "That code has already been used by as many students as it allows. Ask for a new one.",
} as const;

export async function redeemInvite(code: string): Promise<PilotResult> {
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? REDEEM_MESSAGES.invalid };
  if (!(await getCurrentAccount())) return { ok: false, message: SIGNED_OUT };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("redeem_invite", { code: parsed.data });
  if (error || !data) {
    logFailure("redeemInvite", error?.code);
    return { ok: false, message: NOT_SAVED };
  }
  if (data === "ok" || data === "already") {
    refresh();
    return { ok: true, message: REDEEM_MESSAGES[data] };
  }
  return { ok: false, message: REDEEM_MESSAGES[data] };
}

export async function answerPriceQuestion(answer: string, priceNgn: number): Promise<PilotResult> {
  const parsed = priceAnswerSchema.safeParse(answer);
  if (!parsed.success || !Number.isInteger(priceNgn)) return { ok: false, message: NOT_SAVED };
  if (!(await getCurrentAccount())) return { ok: false, message: SIGNED_OUT };
  const supabase = await createSupabaseServerClient();
  // The database accepts it only for the price being asked, while the question is open.
  const { error } = await supabase.from("price_answers").insert({ price_ngn: priceNgn, answer: parsed.data });
  if (error && error.code !== "23505") {
    logFailure("answerPriceQuestion", error.code);
    return { ok: false, message: "Your answer wasn’t saved. The question may have closed." };
  }
  refresh();
  return { ok: true, message: "Thank you. Your answer helps us set a fair price." };
}

export async function savePilotSettings(input: { inviteOnly: boolean; priceQuestionOpen: boolean; priceNgn: string }): Promise<PilotResult> {
  const parsed = pilotSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted box.", fieldErrors: fieldErrorsFrom(parsed.error) };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: NOT_ADMIN };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pilot_settings")
    .update({ invite_only: parsed.data.inviteOnly, price_question_open: parsed.data.priceQuestionOpen, price_ngn: parsed.data.priceNgn })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) {
    logFailure("savePilotSettings", error?.code);
    return { ok: false, message: NOT_SAVED };
  }
  refresh();
  return { ok: true, message: "Saved." };
}

export async function createInvite(input: { label: string; maxUses: string; expiresInDays: string }): Promise<PilotResult> {
  const parsed = newInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted boxes.", fieldErrors: fieldErrorsFrom(parsed.error) };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: NOT_ADMIN };
  const supabase = await createSupabaseServerClient();
  const expiresAt = parsed.data.expiresInDays ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString() : null;
  // A clash with an existing code is very unlikely; try again once if it happens.
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = generateInviteCode();
    const { error } = await supabase
      .from("invite_codes")
      .insert({ code, label: parsed.data.label, max_uses: parsed.data.maxUses, expires_at: expiresAt });
    if (!error) {
      refresh();
      return { ok: true, message: `Created ${code}.` };
    }
    if (error.code !== "23505") {
      logFailure("createInvite", error.code);
      return { ok: false, message: NOT_SAVED };
    }
  }
  return { ok: false, message: NOT_SAVED };
}

export async function disableInvite(id: string): Promise<PilotResult> {
  if (!inviteIdSchema.safeParse(id).success) return { ok: false, message: "That code could not be found." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: NOT_ADMIN };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("invite_codes").update({ disabled: true }).eq("id", id).select("id");
  if (error || !data?.length) {
    logFailure("disableInvite", error?.code);
    return { ok: false, message: NOT_SAVED };
  }
  refresh();
  return { ok: true };
}
