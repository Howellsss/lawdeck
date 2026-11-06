// Security headers sent with every page and file (step 7g, rule P-05). They tell browsers to:
// - never show Lawdeck inside another site's frame (stops "clickjacking");
// - never guess a file's type from its contents (a file is only what the server says it is);
// - send only Lawdeck's address, not the full page address, when following a link elsewhere;
// - keep location and payment switched off, and allow the microphone and camera only on Lawdeck's
//   own pages (speaking a question, chat voice notes, and study group calls, founder 2026-11-06:
//   cameras stay off until the student turns theirs on);
// - use secure (https) connections only, for two years.
//
// The content security policy (which scripts, styles and connections a page may use) is sent in
// "report only" mode first: browsers report what it would block to /api/csp-report, and nothing
// is blocked. It is switched on once the reports show it breaks nothing (Google sign-in and the
// Google Drive picker load Google's scripts and frames).

const GOOGLE_SCRIPTS = "https://apis.google.com https://accounts.google.com";
const GOOGLE_FRAMES = "https://docs.google.com https://accounts.google.com https://content.googleapis.com";
const GOOGLE_APIS = "https://www.googleapis.com https://content.googleapis.com https://accounts.google.com";
// Study group calls connect to LiveKit Cloud (docs/specs/chat.md, step 4f).
const LIVEKIT = "wss://*.livekit.cloud https://*.livekit.cloud";

export function contentSecurityPolicy(supabaseUrl: string | undefined, dev: boolean): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  return [
    "default-src 'self'",
    // Next.js adds small inline scripts to each page; without per-request codes these need 'unsafe-inline'.
    `script-src 'self' 'unsafe-inline' ${GOOGLE_SCRIPTS}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    // Pictures shared in campus chat open from short-lived private links on the Supabase store.
    `img-src 'self' data: blob: https://*.googleusercontent.com https://ssl.gstatic.com ${supabase}`.trim(),
    "font-src 'self'",
    // Answers read aloud play from audio made in the page; chat voice notes from the Supabase store.
    `media-src 'self' blob: data: ${supabase}`.trim(),
    `connect-src 'self' ${supabase} ${GOOGLE_APIS} ${LIVEKIT}`.trim(),
    `frame-src ${GOOGLE_FRAMES}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${supabase} https://accounts.google.com`.trim(),
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
  ].join("; ");
}

export function securityHeaders(supabaseUrl: string | undefined, dev: boolean): { key: string; value: string }[] {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(supabaseUrl, dev) },
  ];
}
