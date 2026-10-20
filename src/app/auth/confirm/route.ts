import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safeNextPath";
import { emailLinkTypeSchema } from "@/schemas/auth";
import { getSupabaseConfig } from "@/server/auth/config";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Opened from the links in Lawdeck's emails (confirm account, reset password).
// A valid link signs the student in, then sends them on to `next` (a Lawdeck page only).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const failed = new URL("/sign-in?error=link", request.url);

  if (!getSupabaseConfig()) return NextResponse.redirect(failed);
  const supabase = await createSupabaseServerClient();

  const tokenHash = params.get("token_hash");
  const type = emailLinkTypeSchema.safeParse(params.get("type"));
  const code = params.get("code");

  let ok = false;
  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type.data });
    ok = !error;
    if (error) console.warn("auth link failed", { kind: "token_hash", code: error.code ?? "unknown" });
  } else if (code) {
    // Older link style; only works in the same browser that asked for the email.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.warn("auth link failed", { kind: "code", code: error.code ?? "unknown" });
  }

  return NextResponse.redirect(ok ? new URL(next, request.url) : failed);
}
