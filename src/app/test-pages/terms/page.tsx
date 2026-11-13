import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TermsGate } from "@/components/account/TermsGate";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { testPagesEnabled } from "../sample";

// Terms acceptance test only (tests/voice/terms.spec.ts): the sign-up tick box and "Before you
// continue". Sending needs an account. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
const links = { terms: "/terms", privacy: "/privacy" };

export default function TestTermsPage() {
  return (
    <Suspense fallback={null}>
      <TestTerms />
    </Suspense>
  );
}

async function TestTerms() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Create your account</h1>
      <SignUpForm terms={links} />
      <TermsGate {...links} />
    </div>
  );
}
