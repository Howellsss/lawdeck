import type { Metadata } from "next";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { isGoogleSignInEnabled } from "@/server/auth/config";
import Link from "next/link";
import { AuthHero } from "@/components/auth/AuthHero";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in · Lawdeck" };

export default function SignInPage() {
  return (
    <>
      <AuthHero title="The law, within reach">
        Learn every Law School course and practise drafting in Nigerian formats.
      </AuthHero>
      {isGoogleSignInEnabled() && (
        <div className="flex w-full flex-col gap-4">
          <GoogleButton />
          <OrDivider />
        </div>
      )}
      <SignInForm />
      <p className="text-sm text-muted">
        New to Lawdeck? <Link href="/sign-up">Create an account</Link>
      </p>
      <p className="text-sm text-muted">
        <Link href="/takedown">Request removal of material</Link>
      </p>
    </>
  );
}
