import { type NextRequest, NextResponse } from "next/server";
import { z } from "@/lib/zod";
import { reportError } from "@/server/monitoring/sentry";

// Errors from students' browsers (step 7e, rule I-04), passed on to Sentry so the Sentry address
// never reaches the browser. Any page can crash, signed in or not, so anyone may send one: it is
// size-limited, checked, scrubbed before sending (src/server/monitoring/scrub.ts) and rate-limited.
const MAX_BYTES = 2_000;
const reportSchema = z.object({
  type: z.string().max(60),
  message: z.string().max(1000),
  path: z.string().startsWith("/").max(500),
});

export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "");
  if (text.length === 0 || text.length > MAX_BYTES) return new NextResponse(null, { status: 400 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  await reportError({ ...parsed.data, source: "browser", where: "browser" });
  return new NextResponse(null, { status: 204 });
}
