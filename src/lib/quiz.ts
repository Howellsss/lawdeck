import { z } from "@/lib/zod";

// A group quiz as each player sees it (migration 61, chat_quiz_state). Checked on arrival so the
// screen never shows something the database did not send.
export const quizStateSchema = z.object({
  id: z.uuid(),
  status: z.enum(["lobby", "live", "done"]),
  topic: z.string(),
  host: z.string(),
  isHost: z.boolean(),
  joined: z.boolean(),
  players: z.number().int(),
  total: z.number().int(),
  current: z.number().int(),
  seconds: z.number().int(),
  secondsLeft: z.number(),
  answered: z.number().int(),
  question: z.object({ prompt: z.string(), choices: z.array(z.string()) }).nullable(),
  closed: z.boolean(),
  correctChoice: z.number().int().nullable(),
  explanation: z.string().nullable(),
  myChoice: z.number().int().nullable(),
  myCorrect: z.boolean().nullable(),
  myPoints: z.number().int().nullable(),
  leaderboard: z.array(z.object({ name: z.string(), points: z.number().int(), correct: z.number().int(), me: z.boolean() })),
});
export type QuizState = z.infer<typeof quizStateSchema>;

export function parseQuizState(value: unknown): QuizState | null {
  const parsed = quizStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// "1st", "2nd", "3rd", "4th"…
export function place(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}
