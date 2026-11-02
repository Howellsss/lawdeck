// Google only lets the Drive picker open on addresses registered in Google Cloud. Lawdeck registers
// its one live address (SITE_URL, mylawdeck.com); on any other address (a test preview, the old
// vercel.app address) Google shows an "Access blocked: origin_mismatch" page instead (founder,
// 2026-11-02: "I don't ever want to see it again"). So the picker opens only on the live address,
// or on the developer's own computer.

const DEFAULT_LIVE_ORIGIN = "https://mylawdeck.com";

// The live address as an origin ("https://mylawdeck.com"). Test previews may not have SITE_URL
// set, so the live address is assumed then.
export function liveOrigin(siteUrl: string | undefined): string {
  if (!siteUrl) return DEFAULT_LIVE_ORIGIN;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return DEFAULT_LIVE_ORIGIN;
  }
}

// Whether the picker may open on the address the admin is on now.
export function driveWorksHere(current: string, live: string): boolean {
  if (current === live) return true;
  try {
    const { hostname } = new URL(current);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
