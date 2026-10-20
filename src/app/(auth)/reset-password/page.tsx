import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHero } from "@/components/auth/AuthHero";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { StateMessage } from "@/components/ui/StateMessage";
import { getCurrentAccount } from "@/server/auth/session";

export const metadata: Metadata = { title: "Choose a new password · Lawdeck" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p role="status" className="text-muted">Checking your link…</p>}>
      <ResetPasswordGate />
    </Suspense>
  );
}

// Only someone who arrived through a valid reset link (which signs them in) sees the form.
async function ResetPasswordGate() {
  const account = await getCurrentAccount();
  if (!account) {
    return (
      <StateMessage title="This link has expired" action={{ label: "Ask for a new reset link", href: "/forgot-password" }}>
        Reset links work once and only for a short time.
      </StateMessage>
    );
  }
  return (
    <>
      <AuthHero title="Choose a new password" />
      <ResetPasswordForm />
    </>
  );
}
