import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonReader } from "@/components/study/LessonReader";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { topicIdSchema } from "@/schemas/lesson";
import { getStudyLesson } from "@/server/db/study";

export const metadata: Metadata = { title: "Study · Lawdeck" };

// Study a topic (docs/specs/remembrance.md, Phase 1b): the approved lesson, recall questions while
// reading, the topic test and its report. Reading costs no AI.
export default function StudyPage({ params }: PageProps<"/study/[topicId]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the lesson" />}>
        <Study params={params} />
      </Suspense>
    </div>
  );
}

async function Study({ params }: { params: Promise<{ topicId: string }> }) {
  const id = topicIdSchema.safeParse((await params).topicId);
  if (!id.success) notFound();
  const result = await getStudyLesson(id.data);
  if (result.status === "signed-out") return <SignInPrompt what="lessons" returnTo={`/study/${id.data}`} />;
  if (!result.data) notFound();
  const data = result.data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/courses/${data.course.slug}`} className="text-sm text-muted">
          ← {data.course.name}
        </Link>
        <h1 className="font-serif text-3xl font-normal text-greeting">{data.topic.name}</h1>
      </div>
      {data.lesson ? (
        <LessonReader data={{ ...data, lesson: data.lesson }} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          This topic&rsquo;s lesson isn&rsquo;t ready yet: it is being written and checked by Lawdeck&rsquo;s reviewers. Meanwhile, use
          Explain or MCQ on the <Link href={`/courses/${data.course.slug}`}>course page</Link>.
        </p>
      )}
    </>
  );
}
