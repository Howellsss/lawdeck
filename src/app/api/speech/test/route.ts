import type { NextRequest } from "next/server";
import { voiceTestSchema } from "@/schemas/voice";
import { speakableText } from "@/lib/speech";
import { speechConfigured } from "@/server/ai/speech";
import { getStaffRole } from "@/server/auth/roles";
import { speakText } from "@/server/learn/speech";

export const maxDuration = 30;

function refuse(status: number, message: string) {
  return Response.json({ message }, { status });
}

// Admin → Voice test: reviewers and admins hear any short text, to check how names sound
// before adding them to the pronunciation list. Students cannot use it.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return refuse(403, "Not allowed.");
  if (!(await getStaffRole())) return refuse(404, "Not found.");
  const body = voiceTestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return refuse(400, body.error.issues[0]?.message ?? "Type something to hear.");
  if (!speechConfigured()) return refuse(503, "Reading aloud is not switched on yet: add the Azure key on Vercel.");
  const result = await speakText(speakableText(body.data.text), body.data.voice);
  if (!result.ok) return refuse(result.status, result.message);
  return new Response(result.audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
}
