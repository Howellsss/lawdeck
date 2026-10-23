"use server";

import { redirect } from "next/navigation";
import { deleteAccountSchema } from "@/schemas/account";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Deleting a student's own account (Phase 6, step 6f; PRD AC-05). Their uploaded files are removed
// first, with their own session; then the database deletes the account and everything it owns.
// No service-role key is used. Logs hold the step and error code only (rule I-03).

export type DeleteAccountState = { status: "idle" | "error"; message?: string };

const BUCKET = "uploads";
const TRY_AGAIN = "Your account was not deleted. Please try again.";

function logFailure(step: string, code: string | undefined) {
  console.error("account deletion failed", { step, code: code ?? "unknown" });
}

export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const confirm = formData.get("confirm");
  const parsed = deleteAccountSchema.safeParse({ confirm: typeof confirm === "string" ? confirm.trim() : "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const account = await getCurrentAccount();
  if (!account) return { status: "error", message: "Please sign in again, then try once more." };

  const supabase = await createSupabaseServerClient();
  const files = supabase.storage.from(BUCKET);
  // Remove every file in the student's own folder (a few rounds for students with many files).
  for (let round = 0; round < 20; round++) {
    const listed = await files.list(account.id, { limit: 100 });
    if (listed.error) {
      logFailure("list files", listed.error.name);
      return { status: "error", message: TRY_AGAIN };
    }
    if (listed.data.length === 0) break;
    const removed = await files.remove(listed.data.map((file) => `${account.id}/${file.name}`));
    if (removed.error) {
      logFailure("remove files", removed.error.name);
      return { status: "error", message: TRY_AGAIN };
    }
  }

  const { error } = await supabase.rpc("delete_my_account", { confirm: parsed.data.confirm });
  if (error) {
    logFailure("delete account", error.code);
    if (error.code === "42501" && error.message.includes("founder"))
      return { status: "error", message: "Reviewer and admin accounts are removed by the founder." };
    return { status: "error", message: TRY_AGAIN };
  }
  // The account is gone; clear this browser's sign-in too.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/account-deleted");
}
