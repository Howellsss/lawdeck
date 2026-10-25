import type { NextRequest } from "next/server";
import { askSchema, chatIdSchema } from "@/schemas/learn";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { answerQuestion, type AnswerEvent } from "@/server/learn/ask";

// Search, then up to 60 seconds of answer (rule G-10), with room to save it.
export const maxDuration = 120;

function refuse(status: number, message: string) {
  return Response.json({ message }, { status });
}

// Asks a question in the student's own chat and streams the checked answer back as
// newline-delimited JSON events (see AnswerEvent).
export async function POST(request: NextRequest, ctx: RouteContext<"/api/chats/[id]/answer">) {
  // Only Lawdeck's own pages may call this (no requests from other websites).
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return refuse(403, "Not allowed.");

  const account = await getCurrentAccount();
  if (!account) return refuse(401, "Sign in to ask Lawdeck a question.");

  const { id } = await ctx.params;
  const chatId = chatIdSchema.safeParse(id);
  const body = askSchema.safeParse(await request.json().catch(() => null));
  if (!chatId.success) return refuse(404, "That chat could not be found.");
  if (!body.success) return refuse(400, body.error.issues[0]?.message ?? "Type a question.");

  const db = await createSupabaseServerClient();
  const encoder = new TextEncoder();
  // Stop (founder, 2026-10-25): when the student presses Stop or leaves, the AI call stops too,
  // so no more credit is spent, and nothing more is sent to a closed connection.
  const stop = new AbortController();
  request.signal.addEventListener("abort", () => stop.abort());
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      stop.abort();
    },
    async start(controller) {
      const send = (event: AnswerEvent) => {
        if (stop.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          stop.abort();
        }
      };
      try {
        await answerQuestion({
          db,
          userId: account.id,
          chatId: chatId.data,
          question: body.data.question,
          level: body.data.level,
          send,
          signal: stop.signal,
        });
      } catch (error) {
        // A stopped answer is not a failure.
        if (!stop.signal.aborted) {
          // Logs the error name only, never the question or the answer (rule I-03).
          console.error("learn answer failed", { step: "stream", name: (error as Error)?.name });
        }
        send({ type: "error", message: "Something went wrong while answering. Please try again." });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed: the student stopped the answer.
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
