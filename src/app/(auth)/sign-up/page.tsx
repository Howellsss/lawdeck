import type { Metadata } from "next";
import { AuthHero } from "@/components/auth/AuthHero";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Create your account · Lawdeck" };

export default function SignUpPage() {
  return (
    <>
      <AuthHero title="Create your account">Use an email address you can open now: we’ll send you a link to confirm it.</AuthHero>
      <SignUpForm />
    </>
  );
}
