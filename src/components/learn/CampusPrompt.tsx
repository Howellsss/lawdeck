import { CampusForm } from "@/components/account/CampusForm";
import { getCurrentAccount } from "@/server/auth/session";
import { getOwnCampus, listCampuses } from "@/server/db/campuses";

// On the home page, for signed-in students who have not chosen a campus yet (campus chat, Phase 1):
// asked once, then only on the Account page. Nothing for visitors or anyone who has chosen.
export async function CampusPrompt() {
  if (!(await getCurrentAccount())) return null;
  if (await getOwnCampus()) return null;
  const campuses = await listCampuses();
  if (campuses.length === 0) return null;
  return (
    <section aria-label="Your campus" className="w-full max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3 text-left">
      <CampusForm campuses={campuses} campus={null} compact />
    </section>
  );
}
