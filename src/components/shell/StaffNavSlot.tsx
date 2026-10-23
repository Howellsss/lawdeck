import { getStaffRole } from "@/server/auth/roles";
import { StaffNav } from "./StaffNav";

// Shows the Library link to reviewers and admins. Hiding it is only a convenience:
// the Library page checks the role on the server itself.
export async function StaffNavSlot() {
  const role = await getStaffRole().catch(() => null);
  return role ? <StaffNav isAdmin={role === "admin"} /> : null;
}
