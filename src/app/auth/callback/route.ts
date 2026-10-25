import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safeNextPath";
import { getSupabaseConfig } from "@/server/auth/config";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { claimPilotInvite } from "@/server/pilot/invite";

// Google sends the student back here after they choose their account.
// A valid code signs them in; anything else returns to sign-in with a clear message.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const code = params.get("code");

  if (code && getSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A registered tester gets access however they reach sign-in (migration 36). If this
      // fails, the invite page asks again; sign-in itself still works.
      await claimPilotInvite(supabase);
      return NextResponse.redirect(new URL(next, request.url));
    }
    // For example "flow_state_not_found" when sign-in started on a different web address.
    console.warn("google sign-in failed", { step: "exchange", code: error.code ?? "unknown", reason: short(error.message) });
  } else {
    // Google or Supabase sent the student back with an error instead of a code. Their reason
    // says why (for example a wrong Google client secret). It never contains a password or key.
    console.warn("google sign-in failed", {
      step: code ? "not_configured" : "returned_error",
      error: short(params.get("error")),
      code: short(params.get("error_code")),
      reason: short(params.get("error_description")),
    });
  }
  return NextResponse.redirect(new URL("/sign-in?error=google", request.url));
}

function short(value: string | null | undefined): string | null {
  return value ? value.slice(0, 160) : null;
}
