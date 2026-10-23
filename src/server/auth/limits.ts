import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "./supabase";

// Limits on sign-in, sign-up, password-reset and resend attempts (Phase 7, step 7c; rules C-04,
// K-02; migration 29). The database keeps only scrambled (SHA-256) forms of the email and the
// internet address, for a day. Supabase's own limits stay on underneath.

export type AttemptKind = "sign_in" | "sign_up" | "reset" | "resend";

export function scramble(value: string): string {
  return createHash("sha256").update(`lawdeck:${value.trim().toLowerCase()}`).digest("hex");
}

// The visitor's internet address as Vercel passes it on (the first in the list is theirs).
async function clientAddress(): Promise<string> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || "unknown";
}

async function hashes(email: string) {
  return { email_hash: scramble(email), ip_hash: scramble(await clientAddress()) };
}

// Seconds to wait before this attempt may go ahead (0: go ahead). If the check itself fails,
// the attempt goes ahead and Supabase's own limits still apply; the failure is logged (code only).
export async function waitSeconds(kind: AttemptKind, email: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("auth_wait_seconds", { kind, ...(await hashes(email)) });
  if (error) {
    console.error("auth limit check failed", { kind, code: error.code ?? "unknown" });
    return 0;
  }
  return typeof data === "number" && data > 0 ? data : 0;
}

export async function recordAttempt(kind: "sign_in_failed" | "sign_up" | "reset" | "resend", email: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_auth_attempt", { kind, ...(await hashes(email)) });
  if (error) console.error("auth limit record failed", { kind, code: error.code ?? "unknown" });
}

export function waitMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts. Please wait ${minutes} ${minutes === 1 ? "minute" : "minutes"} and try again.`;
}
