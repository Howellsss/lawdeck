import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TopicList } from "@/components/courses/TopicList";
import { NewPracticeForm } from "@/components/practice/NewPracticeForm";
import { testPagesEnabled } from "../sample";

// MCQ test only (tests/voice/mcq.spec.ts): a course's topic list and the MCQ form, to check both
// buttons show at once that they are working. "Not found" unless LAWDECK_TEST_PAGES=1 (never set
// on the live site).
export default function TestMcqPage() {
  return (
    <Suspense fallback={null}>
      <TestMcq />
    </Suspense>
  );
}

async function TestMcq() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <TopicList courseSlug="civil-litigation" topics={[{ id: "00000000-0000-4000-8000-000000000201", slug: "wombat-procedure", name: "Wombat procedure", position: 1 }]} />
      <NewPracticeForm topicId="00000000-0000-4000-8000-000000000202" />
    </div>
  );
}
