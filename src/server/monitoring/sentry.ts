import "server-only";
import { scrubMessage, scrubPath, scrubType } from "./scrub";

// Error alerts (step 7e, rule I-04) through Sentry's free plan, sent with a plain web request:
// no Sentry library. Only the error type, a scrubbed message, the page (ids removed), where it
// happened and the release go to Sentry (rule I-03). Nothing is sent until SENTRY_DSN is set.

const TIMEOUT_MS = 3_000;
// At most this many reports a minute from one server instance, so a fault cannot flood Sentry.
const PER_MINUTE = 20;
let windowStart = 0;
let sentThisWindow = 0;

export type ErrorReport = {
  type: unknown;
  message: string;
  path: string;
  source: "server" | "browser";
  // Where on the server: a page ("render"), an API route ("route"), a server action or the proxy.
  where?: string;
  digest?: string;
};

type Dsn = { endpoint: string; publicKey: string };

// "https://<key>@<host>/<project>" → where to send, and the public key that goes with it.
export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\/+|\/+$/g, "");
    if (url.protocol !== "https:" || !url.username || !/^\d+$/.test(project)) return null;
    return { endpoint: `https://${url.host}/api/${project}/envelope/`, publicKey: url.username };
  } catch {
    return null;
  }
}

// The Sentry "envelope": a header line, an item line and the event, all JSON.
export function buildEnvelope(report: ErrorReport, dsn: string, now = new Date()): string {
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "javascript",
    level: "error",
    environment: process.env.APP_ENV ?? "production",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    transaction: scrubPath(report.path),
    tags: { source: report.source, where: report.where ?? "unknown", digest: report.digest?.slice(0, 40) },
    exception: { values: [{ type: scrubType(report.type), value: scrubMessage(report.message) }] },
  };
  return [JSON.stringify({ event_id: eventId, dsn, sent_at: now.toISOString() }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
}

export async function reportError(report: ErrorReport): Promise<void> {
  const raw = process.env.SENTRY_DSN;
  const dsn = parseDsn(raw);
  if (!dsn || !raw) return;
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentThisWindow = 0;
  }
  if (sentThisWindow >= PER_MINUTE) return;
  sentThisWindow += 1;
  try {
    await fetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=lawdeck/1.0`,
      },
      body: buildEnvelope(report, raw),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Monitoring must never break a page: a failed report is only noted in the server log.
    console.warn("error report not sent");
  }
}
