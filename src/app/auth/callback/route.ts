import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safeNextPath";
import { getSupabaseConfig } from "@/server/auth/config";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Google sends the student back here after they choose their account.
// A valid code signs them in; anything else returns to sign-in with a clear message.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const code = params.get("code");

  if (code && getSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    console.warn("google sign-in failed", { code: error.code ?? "unknown" });
  }
  return NextResponse.redirect(new URL("/sign-in?error=google", request.url));
}
