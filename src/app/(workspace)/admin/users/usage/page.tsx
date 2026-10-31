import { redirect } from "next/navigation";

// The separate usage page was folded into the one Users dashboard (founder, 2026-10-31: "in one
// place, not scattered"). Old links open the Users list ordered by AI cost; the Users page itself
// checks that the visitor is an admin.
export default function UsagePage() {
  redirect("/admin/users?sort=cost");
}
