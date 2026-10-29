import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DraftIntakeForm } from "@/components/draft/DraftIntakeForm";
import { sampleIntake, testPagesEnabled } from "../sample";

// Drafting form test only (tests/voice/draftForm.spec.ts): a template's intake form, to check a
// refused draft keeps the student's answers. "Not found" unless LAWDECK_TEST_PAGES=1 (never set
// on the live site).
export default function TestDraftPage({ searchParams }: PageProps<"/test-pages/draft">) {
  return (
    <Suspense fallback={null}>
      <TestDraft searchParams={searchParams} />
    </Suspense>
  );
}

async function TestDraft({ searchParams }: Pick<PageProps<"/test-pages/draft">, "searchParams">) {
  await connection();
  if (!testPagesEnabled()) notFound();
  const { t } = await searchParams;
  const intake = typeof t === "string" ? sampleIntake(t) : null;
  if (!intake) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <DraftIntakeForm intake={intake} returnTo="/test-pages/draft" />
    </div>
  );
}
