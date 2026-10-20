import "server-only";
import { headers } from "next/headers";

// The site address used in email links. SITE_URL is preferred; otherwise the request's own host.
// Supabase only sends links to addresses on its allowed list, which is the final guard.
export async function siteOrigin(): Promise<string> {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
