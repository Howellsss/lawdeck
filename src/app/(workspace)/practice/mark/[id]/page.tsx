import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnswerForm } from "@/components/marking/AnswerForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { listMarkingQuestions } from "@/server/db/marking";

export const metadata: Metadata = { title: "Answer a question · Lawdeck" };

export default function AnswerPage({ params }: PageProps<"/practice/mark/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/practice/mark" className="text-sm">
        All questions
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the question" />}>
        <Answer params={params} />
      </Suspense>
    </div>
  );
}

async function Answer({ params }: Pick<PageProps<"/practice/mark/[id]">, "params">) {
  const { id } = await params;
  const result = await listMarkingQuestions();
  if (result.status === "signed-out") return <SignInPrompt level={1} what="marked answers" returnTo={`/practice/mark/${id}`} />;
  const question = result.data.find((q) => q.id === id);
  if (!question) notFound();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">{question.title}</h1>
        <p className="text-sm text-muted">
          {[question.courseName, question.topicName].filter(Boolean).join(" · ")} · {question.totalMarks} marks
        </p>
      </div>
      <p className="whitespace-pre-line rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed">{question.question}</p>
      <AnswerForm rubricId={question.id} />
    </>
  );
}
