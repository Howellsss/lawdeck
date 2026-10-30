import "server-only";
import { headers } from "next/headers";

// The site address used in email links. SITE_URL is preferred; otherwise the request's own host.
// Supabase only sends links to addresses on its allowed list, which is the final guard.
export async function siteOrigin(): Promise<string> {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return requestOrigin();
}

// The address the student is on now. Google sign-in must come back to the same address it
// started from: the sign-in check is stored in a cookie for that address only, so returning to
// another one (SITE_URL, for example the new mylawdeck.com) fails (founder, 2026-10-30).
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
