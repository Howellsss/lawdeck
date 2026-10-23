import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account deleted · Lawdeck" };

// Shown once a student's account and data have been deleted (PRD AC-05).
export default function AccountDeletedPage() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="font-serif text-3xl font-normal text-greeting">Your account is deleted</h1>
      <p className="text-base leading-relaxed text-muted">
        Your account and everything in it have been removed from Lawdeck. Thank you for studying with us.
      </p>
      <Link href="/sign-up" className="mt-2">
        Make a new account
      </Link>
    </div>
  );
}
