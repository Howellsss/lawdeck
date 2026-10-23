import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { getCurrentAccount } from "@/server/auth/session";

export const metadata: Metadata = { title: "Account · Lawdeck" };

// The student's account: who is signed in, and deleting the account (PRD AC-05).
export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading your account" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const account = await getCurrentAccount();
  if (!account) return <SignInPrompt level={1} what="account" returnTo="/account" />;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Account</h1>
        <p className="break-all text-sm text-muted">Signed in as {account.email}</p>
      </div>
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
