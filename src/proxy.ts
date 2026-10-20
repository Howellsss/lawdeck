import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Runs before each page loads. Its only job is to keep the student's sign-in fresh
// (Supabase sign-in tokens are short-lived and are renewed here).
// It does NOT decide who may see what: every page, action and route checks that itself.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  // Renews the session if needed. Must run before anything else uses it.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js files, images and the logo so they load without a sign-in check.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
