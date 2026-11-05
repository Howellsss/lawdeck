import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BulkWriteLessons } from "@/components/lessons/BulkWriteLessons";
import { BulkApprovedNote } from "@/components/study/BulkApprovedNote";
import { testPagesEnabled } from "../sample";

// Bulk lessons test only (tests/voice/bulk-lessons.spec.ts): made-up topics; the browser test
// answers the writing requests itself, so nothing reaches the AI. "Not found" unless
// LAWDECK_TEST_PAGES=1.
const course = (n: number) => `00000000-0000-4000-8000-00000000050${n}`;
const topics = [
  { id: "00000000-0000-4000-8000-000000000511", name: "Wombat summons", courseId: course(1), courseName: "Made-up procedure" },
  { id: "00000000-0000-4000-8000-000000000512", name: "Quokka motions", courseId: course(1), courseName: "Made-up procedure" },
  { id: "00000000-0000-4000-8000-000000000513", name: "Possum pleadings", courseId: course(1), courseName: "Made-up procedure" },
  { id: "00000000-0000-4000-8000-000000000514", name: "Koala bail", courseId: course(2), courseName: "Made-up criminal" },
];

export default function TestBulkLessonsPage() {
  return (
    <Suspense fallback={null}>
      <TestBulkLessons />
    </Suspense>
  );
}

async function TestBulkLessons() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Lessons</h1>
      <BulkWriteLessons
        topics={topics}
        courses={[
          { id: course(1), name: "Made-up procedure" },
          { id: course(2), name: "Made-up criminal" },
        ]}
      />
      <BulkApprovedNote lessonId="00000000-0000-4000-8000-000000000520" />
    </div>
  );
}
