// Voice-mode conversation (founder, 2026-10-28): short replies such as "yes, please go on" or
// "what about the exceptions?" carry no topic of their own, so the library is searched with the
// recent conversation as well. Longer questions are searched as they are.
const SHORT_REPLY_WORDS = 8;
const MAX_CHARS = 1200;

export type Turn = { role: "user" | "assistant"; text: string };

export function talkSearchText(question: string, history: Turn[]): string {
  const words = question.trim().split(/\s+/).filter(Boolean).length;
  if (words >= SHORT_REPLY_WORDS || history.length === 0) return question;
  const lastAnswer = [...history].reverse().find((turn) => turn.role === "assistant")?.text ?? "";
  const lastQuestion = [...history].reverse().find((turn) => turn.role === "user")?.text ?? "";
  const context = `${lastQuestion} ${lastAnswer.replace(/\[S\d+(?:\s*,\s*S\d+)*\]/g, "")}`.replace(/\s+/g, " ").trim();
  return `${context.slice(-(MAX_CHARS - question.length - 1))} ${question}`.trim();
}
