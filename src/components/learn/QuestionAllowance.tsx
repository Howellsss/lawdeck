import {
  allowanceNote,
  limitReachedMessage,
  questionsLeft,
} from "@/lib/allowance";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getAllowance } from "@/server/learn/allowance";
import { formatWat } from "@/lib/dates";
import { getOwnAccessUntil } from "@/server/pilot/accessEnd";

// "18 of 30 questions left this month" under the question box (rule K-01). Nothing for visitors,
// reviewers and admins, or if the count cannot be read (the server still checks before answering).
export async function QuestionAllowance() {
  if (!(await getCurrentAccount())) return null;
  const supabase = await createSupabaseServerClient();
  const [allowance, until] = await Promise.all([getAllowance(supabase), getOwnAccessUntil(supabase)]);
  if (!allowance) return null;
  const note = allowanceNote(allowance);
  if (!note) return null;
  // Test access with an end date (migration 43): say when it ends, or that it has ended.
  // Read once per request on the server, after the sign-in check, so the page is never pre-built with it.
  // eslint-disable-next-line react-hooks/purity
  const ended = until !== null && until.getTime() <= Date.now();
  if (questionsLeft(allowance) === 0) {
    return (
      <p role="status" className="text-center text-sm text-warning">
        {ended && allowance.limit === 0
          ? `Your test access ended on ${formatWat(until)}. Thank you for testing Lawdeck.`
          : limitReachedMessage(allowance)}
      </p>
    );
  }
  return (
    <p className="text-center text-sm text-muted">
      {note}
      {until && !ended && ` · test access until ${formatWat(until)}`}
    </p>
  );
}
