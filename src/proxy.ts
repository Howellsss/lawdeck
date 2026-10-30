import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Runs before each page loads. Its only job is to keep the student's sign-in fresh
// (Supabase sign-in tokens are short-lived and are renewed here).
// It does NOT decide who may see what: every page, action and route checks that itself.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  // The live site has one address (SITE_URL, mylawdeck.com). Visits to any other address of the
  // live deployment (lawdeck.vercel.app) move there with the same page and details, so sign-in
  // always finishes on the address it started from (founder, 2026-10-30: "no more vercel").
  const home = canonicalRedirect(request);
  if (home) return NextResponse.redirect(home, 308);

  // Google sign-in sometimes comes back to a page other than /auth/callback (Supabase sends the
  // student to its Site URL when the return address is not on its allowed list), carrying the
  // one-time code. Hand it to the callback, which checks it, so the student is signed in instead
  // of being asked to sign in again (founder, 2026-10-30).
  const finish = signInToFinish(request);
  if (finish) return NextResponse.redirect(finish);

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

export function canonicalRedirect(request: NextRequest): URL | null {
  if (process.env.VERCEL_ENV !== "production" || !process.env.SITE_URL) return null;
  let site: URL;
  try {
    site = new URL(process.env.SITE_URL);
  } catch {
    return null;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  if (!host || host === site.host) return null;
  return new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, site.origin);
}

export function signInToFinish(request: NextRequest): URL | null {
  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code || pathname.startsWith("/auth/") || pathname.startsWith("/api/")) return null;
  const target = new URL("/auth/callback", request.url);
  target.searchParams.set("code", code);
  const rest = new URLSearchParams(searchParams);
  rest.delete("code");
  const query = rest.toString();
  target.searchParams.set("next", query ? `${pathname}?${query}` : pathname);
  return target;
}

export const config = {
  matcher: [
    // Skip Next.js files, images and the logo so they load without a sign-in check.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
