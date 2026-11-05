import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { testPagesEnabled } from "../sample";
import { Marks } from "./Marks";

// Students' own marks (tests/voice/lessonMarks.spec.ts): made-up text, not legal content.
// "Not found" unless LAWDECK_TEST_PAGES=1.
export default function TestLessonMarksPage() {
  return (
    <Suspense fallback={null}>
      <TestLessonMarks />
    </Suspense>
  );
}

async function TestLessonMarks() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Wombat summons</h1>
      <Marks />
    </div>
  );
}
