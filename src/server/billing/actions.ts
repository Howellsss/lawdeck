"use server";

import { refresh } from "next/cache";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { planEditSchema } from "@/schemas/billing";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type PlanResult = { ok: true; message: string } | { ok: false; message: string; fieldErrors?: FieldErrors };

// Admin → Plans: changes a plan's monthly price and credits. Checked here and again in the
// database (save_plan: admins only, the Free plan stays free, recorded in the audit log).
export async function savePlan(input: { planId: string; price: string; credits: string }): Promise<PlanResult> {
  const parsed = planEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted box.", fieldErrors: fieldErrorsFrom(parsed.error) };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can change plans." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_plan", {
    plan: parsed.data.planId,
    price: parsed.data.price,
    credits: parsed.data.credits,
  });
  if (error) {
    console.error("save plan failed", { code: error.code });
    if (error.code === "22023") return { ok: false, message: "The Free plan stays free: its price must be 0." };
    return { ok: false, message: "That wasn’t saved. Please try again." };
  }
  refresh();
  return { ok: true, message: "Saved. New payments use this price; students who already paid keep theirs until their month ends." };
}
