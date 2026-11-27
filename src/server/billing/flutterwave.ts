import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "@/lib/zod";
import { createAdminClient } from "@/server/db/admin";

// ADMIN JOB (CLAUDE.md: service-role key only in marked admin jobs). The only file that talks to
// Flutterwave (founder, 2026-11-18: Flutterwave, pay each month; launch task 15, part 2).
// - A checkout link is made for a payment the student started (start_payment, migration 73).
// - A payment is recorded only after Lawdeck asks Flutterwave itself, by transaction id, and the
//   answer matches: successful, naira, at least the amount, Lawdeck's own reference. Nothing the
//   browser or a notice says is trusted on its own. record_payment counts each payment once.
// Keys are server-only (FLUTTERWAVE_SECRET_KEY, FLUTTERWAVE_WEBHOOK_HASH). Logs never contain
// card, email or payment details: only Lawdeck's reference, a status and error codes.

const API = "https://api.flutterwave.com/v3";
const TIMEOUT_MS = 15_000;

export function flutterwaveConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY?.trim());
}

function secret(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
  if (!key) throw new Error("Flutterwave is not set up.");
  return key;
}

const TX_REF = /^ldk_[0-9a-f]{32}$/;
export const txRefSchema = z.string().regex(TX_REF);
export const transactionIdSchema = z.string().regex(/^[0-9]{1,20}$/);

// --- Starting a payment ---------------------------------------------------------------------
const linkSchema = z.object({ status: z.literal("success"), data: z.object({ link: z.url() }) });

export async function createCheckoutLink(input: {
  txRef: string;
  amountNgn: number;
  email: string;
  planName: string;
  redirectUrl: string;
}): Promise<string | null> {
  try {
    const res = await fetch(`${API}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: input.txRef,
        amount: input.amountNgn,
        currency: "NGN",
        redirect_url: input.redirectUrl,
        payment_options: "card,banktransfer,ussd",
        customer: { email: input.email },
        customizations: { title: "Lawdeck", description: `Lawdeck ${input.planName}: one month` },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const parsed = linkSchema.safeParse(await res.json().catch(() => null));
    if (!res.ok || !parsed.success) {
      console.error("flutterwave checkout failed", { status: res.status });
      return null;
    }
    // Only ever send the student to Flutterwave's own checkout.
    const link = new URL(parsed.data.data.link);
    if (link.protocol !== "https:" || !/(^|\.)flutterwave\.com$/.test(link.hostname)) {
      console.error("flutterwave checkout failed", { reason: "unexpected link" });
      return null;
    }
    return link.toString();
  } catch (error) {
    console.error("flutterwave checkout failed", { name: (error as Error)?.name });
    return null;
  }
}

// --- Checking a payment with Flutterwave ----------------------------------------------------
const verifySchema = z.object({
  status: z.string(),
  data: z.object({
    id: z.coerce.number().int(),
    tx_ref: z.string(),
    status: z.string(),
    amount: z.coerce.number(),
    currency: z.string(),
  }),
});
export type VerifiedPayment = z.infer<typeof verifySchema>["data"];

export async function verifyTransaction(transactionId: string): Promise<VerifiedPayment | null> {
  if (!transactionIdSchema.safeParse(transactionId).success) return null;
  try {
    const res = await fetch(`${API}/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${secret()}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const parsed = verifySchema.safeParse(await res.json().catch(() => null));
    if (!res.ok || !parsed.success || parsed.data.status !== "success") {
      console.error("flutterwave verify failed", { status: res.status });
      return null;
    }
    return parsed.data.data;
  } catch (error) {
    console.error("flutterwave verify failed", { name: (error as Error)?.name });
    return null;
  }
}

export type PaymentCheck = "paid" | "failed" | "pending" | "mismatch";

// What Flutterwave's own answer means for this payment. The amount and currency are checked
// again in the database against what the student was asked to pay.
export function judgePayment(verified: VerifiedPayment, expectedRef: string): PaymentCheck {
  if (verified.tx_ref !== expectedRef) return "mismatch";
  if (verified.status === "successful") return verified.currency === "NGN" ? "paid" : "mismatch";
  if (verified.status === "failed" || verified.status === "cancelled") return "failed";
  return "pending";
}

export type ConfirmResult =
  | { status: "paid"; planName: string; periodEnd: string }
  | { status: "failed" | "pending" | "error" };

// Checks a payment with Flutterwave and, if it succeeded, records the paid month (once).
export async function confirmPayment(txRef: string, transactionId: string): Promise<ConfirmResult> {
  if (!txRefSchema.safeParse(txRef).success || !transactionIdSchema.safeParse(transactionId).success) return { status: "error" };
  const verified = await verifyTransaction(transactionId);
  if (!verified) return { status: "error" };
  const verdict = judgePayment(verified, txRef);
  const admin = createAdminClient();
  if (!admin) return { status: "error" };
  if (verdict === "failed") {
    await admin.rpc("fail_payment", { ref: txRef });
    return { status: "failed" };
  }
  if (verdict === "pending") return { status: "pending" };
  if (verdict === "mismatch") {
    console.error("flutterwave payment mismatch", { txRef });
    return { status: "error" };
  }
  const { data, error } = await admin.rpc("record_payment", {
    ref: txRef,
    provider_id: String(verified.id),
    paid_amount: verified.amount,
    paid_currency: verified.currency,
  });
  if (error || !data?.[0]) {
    console.error("record payment failed", { txRef, code: error?.code });
    return { status: "error" };
  }
  return { status: "paid", planName: data[0].plan_name, periodEnd: data[0].period_end };
}

// --- Flutterwave's payment notices ----------------------------------------------------------
// The notice must carry the secret phrase set in Flutterwave (Settings → Webhooks → Secret hash).
export function noticeIsGenuine(header: string | null): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH?.trim();
  if (!expected || !header) return false;
  // Compared as fixed-length digests, so the time taken never reveals the phrase.
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const noticeSchema = z.object({
  data: z.object({ id: z.coerce.number().int().positive(), tx_ref: z.string() }),
});
