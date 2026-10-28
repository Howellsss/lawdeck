import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";
import { NameForm } from "@/components/account/NameForm";
import { InviteCodeForm } from "@/components/pilot/InviteCodeForm";
import { VoicePicker } from "@/components/voice/VoicePicker";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { speechConfigured } from "@/server/ai/speech";
import { getCurrentAccount } from "@/server/auth/session";
import { getOwnName } from "@/server/db/profile";
import { getPilotStatus } from "@/server/db/pilot";

export const metadata: Metadata = { title: "Account · Lawdeck" };

// The student's account: who is signed in, and deleting the account (PRD AC-05).
export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading your account" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const account = await getCurrentAccount();
  if (!account) return <SignInPrompt level={1} what="account" returnTo="/account" />;
  const name = await getOwnName();
  const pilot = await getPilotStatus().catch(() => null);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Account</h1>
        <p className="break-all text-sm text-muted">Signed in as {account.email}</p>
      </div>
      {pilot?.inviteOnly && !pilot.hasAccess && (
        <section aria-labelledby="invite-heading" className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 id="invite-heading" className="text-lg font-medium">
            Join the pilot
          </h2>
          <p className="text-sm text-muted">Lawdeck is open to invited testers for now. Enter an invite code if you have one; otherwise the Lawdeck team will give you access soon.</p>
          <InviteCodeForm />
        </section>
      )}
      <section aria-labelledby="name-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="name-heading" className="text-lg font-medium">
          Your details
        </h2>
        <NameForm name={name} />
      </section>
      {speechConfigured() && (
        <section aria-labelledby="voice-heading" className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 id="voice-heading" className="text-lg font-medium">
            Reading voice
          </h2>
          <p className="text-sm text-muted">The voice that reads answers aloud when you press Read or use voice mode.</p>
          <VoicePicker />
        </section>
      )}
      <section aria-labelledby="delete-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="delete-heading" className="text-lg font-medium">
          Delete account
        </h2>
        <p className="text-sm text-muted">Deleting your account removes all your data from Lawdeck straight away.</p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
