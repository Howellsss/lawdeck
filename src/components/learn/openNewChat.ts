import { startChat, type StartChatResult } from "@/server/learn/actions";
import { savePendingQuestion, savePendingTalk } from "./askStream";

type Router = { push: (href: string) => void };

// Starts a Learn chat and opens it; the chat page then asks the question. Returns the
// problem instead when the chat could not be started (signed out, routed to Draft, offline).
export async function openNewChat(
  router: Router,
  input: { question: string; course: string; mode: "auto" | "learn"; talk?: boolean },
): Promise<Extract<StartChatResult, { ok: false }> | null> {
  const { question, course, mode } = input;
  const started = await startChat({ question, course, mode }).catch(() => ({
    ok: false as const,
    message:
      "Lawdeck could not be reached. Check your connection and try again.",
  }));
  if (!started.ok) return started;
  savePendingQuestion(started.id, input.question);
  if (input.talk) savePendingTalk(started.id);
  router.push(`/chats/${started.id}`);
  return null;
}
