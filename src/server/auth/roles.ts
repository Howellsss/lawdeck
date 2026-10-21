import "server-only";
import { getCurrentAccount } from "./session";
import { createSupabaseServerClient } from "./supabase";

export type StaffRole = "admin" | "reviewer" | null;

// The signed-in person's library role, checked by the database (never trusted from the browser).
export async function getStaffRole(): Promise<StaffRole> {
  if (!(await getCurrentAccount())) return null;
  const supabase = await createSupabaseServerClient();
  const [admin, reviewer] = await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_reviewer")]);
  if (admin.data === true) return "admin";
  if (reviewer.data === true) return "reviewer";
  return null;
}
