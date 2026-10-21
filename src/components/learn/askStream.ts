import type { AnswerEvent } from "@/server/learn/ask";

// Sends a question to the answer route and reads the answer as it streams
// (one JSON event per line). Calls onEvent for each event, in order.
export async function askQuestion(
  chatId: string,
  question: string,
  onEvent: (event: AnswerEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/chats/${chatId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal,
    });
  } catch {
    return onEvent({ type: "error", message: "Lawdeck could not be reached. Check your connection and try again." });
  }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    return onEvent({ type: "error", message: body?.message ?? "Lawdeck could not answer. Please try again." });
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "";
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += value;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as AnswerEvent;
        if (event.type !== "text") finished = true;
        onEvent(event);
      }
    }
  } catch {
    if (signal?.aborted) return;
    return onEvent({ type: "error", message: "The answer was cut off. Check your connection and try again." });
  }
  if (!finished) onEvent({ type: "error", message: "The answer was cut off. Please try again." });
}

// The question to ask when a chat page opens straight after the home composer started it.
// Kept in this browser tab only; never in the address bar (it is the student's own words).
const PENDING_KEY = (chatId: string) => `lawdeck-ask-${chatId}`;

export function savePendingQuestion(chatId: string, question: string) {
  try {
    sessionStorage.setItem(PENDING_KEY(chatId), question);
  } catch {
    // Private browsing may block storage; the student can still type the question again.
  }
}

export function takePendingQuestion(chatId: string): string | null {
  try {
    const question = sessionStorage.getItem(PENDING_KEY(chatId));
    sessionStorage.removeItem(PENDING_KEY(chatId));
    return question;
  } catch {
    return null;
  }
}
