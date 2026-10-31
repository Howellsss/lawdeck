import Link from "next/link";
import { getCurrentAccount } from "@/server/auth/session";
import { getGreetingName } from "@/server/db/profile";

// On the home page, for signed-in students Lawdeck has no name for (those who signed up by email
// before sign-up asked for one): a short link to add it, so the greeting can use it (founder,
// 2026-10-31). Nothing for visitors or anyone with a name.
export async function NamePrompt() {
  if (!(await getCurrentAccount())) return null;
  if (await getGreetingName()) return null;
  return (
    <p className="w-full max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3 text-left text-[15px]">
      What should Lawdeck call you? <Link href="/account#name-heading">Add your name</Link>
    </p>
  );
}
