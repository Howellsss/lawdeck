import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VisualRevision } from "@/components/study/VisualRevision";
import { TopicStories } from "@/components/study/TopicStories";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { topicIdSchema } from "@/schemas/lesson";
import { getStudyLesson } from "@/server/db/study";

export const metadata: Metadata = { title: "Visual revision · Lawdeck" };

// Visual Revision Mode (docs/specs/remembrance.md, Phase 3b): a topic's marked points, filtered.
export default function VisualRevisionPage({ params }: PageProps<"/study/[topicId]/visual">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the points to revise" />}>
        <Visual params={params} />
      </Suspense>
    </div>
  );
}

async function Visual({ params }: { params: Promise<{ topicId: string }> }) {
  const id = topicIdSchema.safeParse((await params).topicId);
  if (!id.success) notFound();
  const result = await getStudyLesson(id.data);
  if (result.status === "signed-out") return <SignInPrompt what="revision" returnTo={`/study/${id.data}/visual`} />;
  if (!result.data) notFound();
  const data = result.data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/study/${data.topic.id}`} className="text-sm text-muted">
          ← Back to the lesson
        </Link>
        <h1 className="font-serif text-3xl font-normal text-greeting">Revise visually: {data.topic.name}</h1>
        <p className="text-muted">The important points of this topic, each in its own sentence, without rereading every paragraph.</p>
      </div>
      {data.lesson && <TopicStories stories={data.stories} authorityNames={new Map(data.authorities.map((a) => [a.key, a.name]))} open />}
      {data.lesson ? (
        <VisualRevision topicId={data.topic.id} content={data.lesson.content} annotations={data.annotations} authorities={data.authorities} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          This topic&rsquo;s lesson isn&rsquo;t ready yet. <Link href={`/courses/${data.course.slug}`}>Back to the course</Link>
        </p>
      )}
    </>
  );
}
