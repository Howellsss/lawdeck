import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthHero } from "@/components/auth/AuthHero";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { secondaryButton } from "@/components/ui/buttons";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { signOut } from "@/server/auth/actions";
import { getCurrentAccount } from "@/server/auth/session";
import { claimPilotInvite } from "@/server/pilot/invite";

export const metadata: Metadata = { title: "Welcome · Lawdeck" };

// After Continue with Google on the invite page: registered testers go straight in; anyone else
// is told their email is not registered (migration 36).
export default function InviteWelcomePage() {
  return (
    <Suspense fallback={<LoadingRows label="Checking your invite" />}>
      <InviteResult />
    </Suspense>
  );
}

async function InviteResult() {
  const account = await getCurrentAccount();
  if (!account) redirect("/invite");
  const claim = await claimPilotInvite();
  if (claim === "ok" || claim === "open") redirect("/");

  if (claim === "use_google") {
    return (
      <>
        <AuthHero title="Continue with Google">
          Your email is registered. To join, continue with Google using {account.email}.
        </AuthHero>
        <div className="flex w-full flex-col gap-4">
          <GoogleButton next="/invite/welcome" />
        </div>
      </>
    );
  }

  if (claim === "error") {
    return (
      <>
        <AuthHero title="Something went wrong">Lawdeck couldn’t check your invite just now.</AuthHero>
        <Link href="/invite/welcome" className={`${secondaryButton} w-full`}>
          Try again
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHero title="Sorry, your email is not registered">
        You signed in as {account.email}. Lawdeck is open to invited testers for now. Ask the person who invited you to register
        this email, or sign out and continue with the Google account they registered.
      </AuthHero>
      <form action={signOut} className="w-full">
        <input type="hidden" name="next" value="/invite" />
        <button type="submit" className={`${secondaryButton} w-full`}>
          Sign out and use another account
        </button>
      </form>
    </>
  );
}
