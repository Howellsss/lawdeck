import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { listMarkingQuestions } from "@/server/db/marking";

export const metadata: Metadata = { title: "Mark my answer · Lawdeck" };

// Exam-style questions approved by a legal reviewer; the student answers one and Lawdeck marks it.
export default function MarkPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Link href="/practice" className="text-sm">
        All practice
      </Link>
      <h1 className="font-serif text-3xl font-normal text-greeting">Mark my answer</h1>
      <Suspense fallback={<LoadingRows label="Loading the questions" />}>
        <Questions />
      </Suspense>
    </div>
  );
}

async function Questions() {
  const result = await listMarkingQuestions();
  if (result.status === "signed-out") return <SignInPrompt what="marked answers" returnTo="/practice/mark" />;
  return (
    <>
      <p className="text-muted">
        Choose an exam-style question, write your answer, and Lawdeck marks it against a guide approved by a legal reviewer.
      </p>
      {result.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No questions are ready for marking yet. They appear here once a legal reviewer approves them.
        </p>
      ) : (
        <ul aria-label="Questions to answer" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {result.data.map((q) => (
            <li key={q.id} className="flex flex-col gap-1 px-4 py-3">
              <Link href={`/practice/mark/${q.id}`} className="break-words font-medium">
                {q.title}
              </Link>
              <span className="text-sm text-muted">
                {[q.courseName, q.topicName].filter(Boolean).join(" · ")} · {q.totalMarks} marks
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
