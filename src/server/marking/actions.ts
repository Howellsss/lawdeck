"use server";

import { markAnswerSchema } from "@/schemas/marking";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { markAnswer, type MarkAnswerResult } from "./mark";

// "Mark my answer" (step 4e). Input checked with Zod and sign-in on the server; the marked answer
// is saved in the student's own Practice (row-level security).
export async function submitAnswerForMarking(input: { rubricId: string; answer: string }): Promise<MarkAnswerResult & { signIn?: boolean }> {
  const parsed = markAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Write your answer first." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, signIn: true, message: "Sign in to have your answer marked." };
  const supabase = await createSupabaseServerClient();
  return markAnswer(supabase, account.id, parsed.data);
}
