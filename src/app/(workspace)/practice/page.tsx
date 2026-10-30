import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { listPracticeSets } from "@/server/db/practice";

export const metadata: Metadata = { title: "MCQ · Lawdeck" };

// The student's practice sets, newest first (Phase 4).
export default function PracticePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">MCQ</h1>
      <Suspense fallback={<LoadingRows label="Loading your MCQ sets" />}>
        <Sets />
      </Suspense>
    </div>
  );
}

async function Sets() {
  const result = await listPracticeSets();
  if (result.status === "signed-out") return <SignInPrompt what="practice sets" returnTo="/practice" />;
  return (
    <>
      <p className="text-muted">
        To make multiple-choice questions, open a course in <Link href="/courses">Courses</Link> and choose <strong>MCQ</strong> next to a
        topic. To have an exam-style answer marked, use <Link href="/practice/mark">Mark my answer</Link>.
      </p>
      {result.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No MCQ sets yet. Your sets will appear here.
        </p>
      ) : (
        <ul aria-label="Your MCQ sets" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {result.data.map((set) => (
            <li key={set.id} className="flex flex-col gap-1 px-4 py-3">
              <Link href={`/practice/${set.id}`} className="break-words font-medium">
                {set.title}
              </Link>
              <span className="text-sm text-muted">
                {formatWat(set.createdAt)} · {set.answered} of {set.questions} {set.kind === "flashcards" ? "known" : "answered"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
