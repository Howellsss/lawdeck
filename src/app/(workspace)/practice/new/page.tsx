import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewPracticeForm } from "@/components/practice/NewPracticeForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { StateMessage } from "@/components/ui/StateMessage";
import { getPracticeTopic } from "@/server/db/practice";

export const metadata: Metadata = { title: "New practice set · Lawdeck" };

// Make a practice set on one topic (PRD LN-06). Reached from "Practise" on a course page.
export default function NewPracticePage({ searchParams }: PageProps<"/practice/new">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the topic" />}>
        <NewSet searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewSet({ searchParams }: Pick<PageProps<"/practice/new">, "searchParams">) {
  const { topic: topicParam } = await searchParams;
  const result = await getPracticeTopic(typeof topicParam === "string" ? topicParam : undefined);
  if (result.status === "signed-out") return <SignInPrompt level={1} what="practice sets" returnTo="/practice/new" />;
  if (!result.data) {
    return (
      <StateMessage title="Choose a topic first" action={{ label: "Go to Courses", href: "/courses" }}>
        Open a course and choose <strong>Practise</strong> next to the topic you want questions on.
      </StateMessage>
    );
  }
  const topic = result.data;
  return (
    <>
      <div className="flex flex-col gap-2">
        <p>
          <Link href={`/courses/${topic.courseSlug}`} className="text-sm">
            {topic.courseName}
          </Link>
        </p>
        <h1 className="font-serif text-3xl font-normal text-greeting">Practise: {topic.name}</h1>
        <p className="text-muted">Lawdeck writes questions from approved course material on this topic, with the sources for every answer.</p>
      </div>
      <NewPracticeForm topicId={topic.id} />
    </>
  );
}
