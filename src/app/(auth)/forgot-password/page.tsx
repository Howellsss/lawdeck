import type { Metadata } from "next";
import { AuthHero } from "@/components/auth/AuthHero";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password · Lawdeck" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHero title="Reset your password">Enter your email and we’ll send you a link to choose a new password.</AuthHero>
      <ForgotPasswordForm />
    </>
  );
}
