import {
  allowanceNote,
  limitReachedMessage,
  questionsLeft,
} from "@/lib/allowance";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getAllowance } from "@/server/learn/allowance";

// "18 of 30 questions left this month" under the question box (rule K-01). Nothing for visitors,
// reviewers and admins, or if the count cannot be read (the server still checks before answering).
export async function QuestionAllowance() {
  if (!(await getCurrentAccount())) return null;
  const allowance = await getAllowance(await createSupabaseServerClient());
  if (!allowance) return null;
  const note = allowanceNote(allowance);
  if (!note) return null;
  if (questionsLeft(allowance) === 0) {
    return (
      <p role="status" className="text-center text-sm text-warning">
        {limitReachedMessage(allowance)}
      </p>
    );
  }
  return <p className="text-center text-sm text-muted">{note}</p>;
}
