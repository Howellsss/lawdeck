import type { NextRequest } from "next/server";
import { VOICE_SAMPLE_TEXT, voiceSampleSchema } from "@/schemas/voice";
import { speechConfigured } from "@/server/ai/speech";
import { getCurrentAccount } from "@/server/auth/session";
import { speakText } from "@/server/learn/speech";

export const maxDuration = 30;

function refuse(status: number, message: string) {
  return Response.json({ message }, { status });
}

// "Hear this voice" on the Account page: a signed-in student hears one fixed sentence in the
// chosen voice. No text is taken from the request; it counts towards the daily reading limit.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return refuse(403, "Not allowed.");
  if (!(await getCurrentAccount())) return refuse(401, "Sign in to hear the voices.");
  const body = voiceSampleSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return refuse(400, "Choose a voice.");
  if (!speechConfigured()) return refuse(503, "Reading aloud is not switched on yet.");
  const result = await speakText(VOICE_SAMPLE_TEXT, body.data.voice);
  if (!result.ok) return refuse(result.status, result.message);
  return new Response(result.audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
}
