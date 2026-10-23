import { type NextRequest, NextResponse } from "next/server";

// Where browsers report what the content security policy would have blocked (step 7g; the policy
// is in "report only" mode, so nothing is blocked yet). Anyone's browser may send a report, so it
// is size-limited and only the rule and the blocked site's name are logged: never a full address,
// which could hold an id or a code.
const MAX_BYTES = 8_000;

export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "");
  if (text.length > 0 && text.length <= MAX_BYTES) {
    try {
      const body = JSON.parse(text) as { "csp-report"?: Record<string, unknown> };
      const report = body["csp-report"];
      if (report) {
        console.warn("csp report", {
          directive: String(report["effective-directive"] ?? report["violated-directive"] ?? "").slice(0, 60),
          blocked: blockedSite(report["blocked-uri"]),
        });
      }
    } catch {
      // Not a report: ignore.
    }
  }
  return new NextResponse(null, { status: 204 });
}

// "inline", "eval", or the blocked site's origin only.
function blockedSite(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  if (!value.includes(":") || value === "inline" || value === "eval") return value.slice(0, 20);
  try {
    return new URL(value).origin.slice(0, 100);
  } catch {
    return "unknown";
  }
}
