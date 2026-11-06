import { getStaffRole } from "@/server/auth/roles";
import { pendingChatChecks } from "@/server/chat/verification";
import { StaffNav } from "./StaffNav";

// Shows the Admin links to reviewers and admins, with the number of chat ID checks waiting.
// Hiding them is only a convenience: each page checks the role on the server itself.
export async function StaffNavSlot() {
  const role = await getStaffRole().catch(() => null);
  if (!role) return null;
  const waiting = role === "admin" ? await pendingChatChecks().catch(() => 0) : 0;
  return <StaffNav isAdmin={role === "admin"} chatWaiting={waiting} />;
}
