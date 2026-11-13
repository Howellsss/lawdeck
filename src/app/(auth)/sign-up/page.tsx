import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { isGoogleSignInEnabled } from "@/server/auth/config";
import { AuthHero } from "@/components/auth/AuthHero";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Create your account · Lawdeck" };

export default function SignUpPage() {
  return (
    <>
      <AuthHero title="Create your account">Use an email address you can open now: we’ll send you a link to confirm it.</AuthHero>
      {isGoogleSignInEnabled() && (
        <div className="flex w-full flex-col gap-4">
          <GoogleButton />
          <OrDivider />
        </div>
      )}
      <SignUpForm />
      <p className="text-center text-sm text-muted">
        By creating an account you agree to Lawdeck’s <Link href="/terms">Terms of Service</Link> and confirm you have read the{" "}
        <Link href="/privacy">Privacy Notice</Link>.
      </p>
    </>
  );
}
