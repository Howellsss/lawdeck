import type { Metadata } from "next";
import { AuthHero } from "@/components/auth/AuthHero";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { isGoogleSignInEnabled } from "@/server/auth/config";

export const metadata: Metadata = { title: "You’re invited · Lawdeck" };

// The invite link the admin sends to registered testers (migration 36). Continue with Google;
// the welcome page then lets registered emails in and tells anyone else plainly.
export default function InvitePage() {
  return (
    <>
      <AuthHero title="You’re invited">
        Welcome to the Lawdeck pilot. Continue with Google, using the email you gave the Lawdeck team.
      </AuthHero>
      {isGoogleSignInEnabled() ? (
        <div className="flex w-full flex-col gap-4">
          <GoogleButton next="/invite/welcome" />
        </div>
      ) : (
        <p role="alert" className="text-center text-sm text-warning">
          Google sign-in isn’t switched on here yet. Please try again on lawdeck.vercel.app.
        </p>
      )}
    </>
  );
}
