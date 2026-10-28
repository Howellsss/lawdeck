import type { NextRequest } from "next/server";
import { speechRequestSchema } from "@/schemas/voice";
import { speechConfigured } from "@/server/ai/speech";
import { getCurrentAccount } from "@/server/auth/session";
import { speakAnswerPart } from "@/server/learn/speech";

export const maxDuration = 30;

function refuse(status: number, message: string) {
  return Response.json({ message }, { status });
}

// Reads one part of a saved answer aloud (founder, 2026-10-28). Returns MP3 audio and, in the
// X-Speech-Parts header, how many parts the answer has, so the page can ask for the next one.
export async function POST(request: NextRequest) {
  // Only Lawdeck's own pages may call this (no requests from other websites).
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return refuse(403, "Not allowed.");

  const account = await getCurrentAccount();
  if (!account) return refuse(401, "Sign in to hear answers read aloud.");
  const body = speechRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return refuse(400, body.error.issues[0]?.message ?? "That answer could not be found.");
  if (!speechConfigured()) return refuse(503, "Reading aloud is not switched on yet.");

  const result = await speakAnswerPart(body.data);
  if (!result.ok) return refuse(result.status, result.message);
  return new Response(result.audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-Speech-Parts": String(result.parts),
    },
  });
}
