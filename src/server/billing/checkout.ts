"use server";

import { z } from "@/lib/zod";
import { siteOrigin } from "@/server/auth/origin";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { createCheckoutLink, flutterwaveConfigured } from "./flutterwave";

export type CheckoutResult = { ok: true; url: string } | { ok: false; message: string };

const planSchema = z.object({ planId: z.uuid({ error: "That plan could not be found." }) });

// The Pay button on the Plans page. The database fixes the price and Lawdeck's reference
// (start_payment, migration 73); the student is then sent to Flutterwave's own payment page.
// The student's email goes to Flutterwave for the receipt; it is never logged.
export async function startCheckout(input: { planId: string }): Promise<CheckoutResult> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That plan could not be found." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, message: "Sign in to choose a plan." };
  if (!flutterwaveConfigured()) return { ok: false, message: "Payments open soon. Please try again later." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_payment", { plan: parsed.data.planId });
  if (error || !data?.[0]) {
    console.error("start payment failed", { code: error?.code });
    if (error?.code === "54000") return { ok: false, message: "Too many payments started. Please try again in an hour." };
    if (error?.code === "22023") return { ok: false, message: "That plan can’t be bought right now." };
    return { ok: false, message: "The payment could not be started. Please try again." };
  }
  const payment = data[0];
  const url = await createCheckoutLink({
    txRef: payment.tx_ref,
    amountNgn: payment.amount_ngn,
    email: account.email,
    planName: payment.plan_name,
    redirectUrl: `${await siteOrigin()}/plans/done`,
  });
  if (!url) return { ok: false, message: "Flutterwave could not be reached. Please try again in a minute." };
  return { ok: true, url };
}
