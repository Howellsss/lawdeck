import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReadInFull } from "@/components/lessons/read/ReadInFull";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { z } from "@/lib/zod";
import { getReadingQueue } from "@/server/db/readInFull";

export const metadata: Metadata = { title: "Read lessons in full · Lawdeck" };

const idSchema = z.uuid();

// Skim, tick and approve (docs/specs/remembrance.md): one course's lessons that still need reading
// in full, one after another. Reviewers and admins only; everyone else gets "page not found".
export default function ReadCoursePage({ params, searchParams }: PageProps<"/admin/lessons/read/[courseId]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the lessons to read" />}>
        <Queue params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Queue({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const course = idSchema.safeParse((await params).courseId);
  if (!course.success) notFound();
  const topic = idSchema.safeParse((await searchParams).topic);
  const queue = await getReadingQueue(course.data, topic.success ? topic.data : undefined);
  if (!queue) notFound();
  const { current, toRead } = queue;
  const at = current ? toRead.findIndex((t) => t.topicId === current.topic.id) : -1;
  const next = at >= 0 ? toRead[at + 1] : undefined;
  const here = `/admin/lessons/read/${queue.course.id}`;

  return (
    <>
      <Link href="/admin/lessons" className="text-sm text-muted">
        ← All lessons
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">Read in full · {queue.course.name}</p>
        <h1 className="font-serif text-3xl font-normal text-greeting">{current ? current.topic.name : queue.course.name}</h1>
        <p className="text-sm text-muted">
          {queue.readInFull} of {queue.total} lessons read in full · {toRead.length} still to read
        </p>
      </div>
      {!current || !current.lesson ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          Every lesson in {queue.course.name} has been read in full. <Link href="/admin/lessons">Back to all lessons</Link>
        </p>
      ) : !current.lesson.content ? (
        <p role="alert" className="rounded-2xl border border-warning px-4 py-3 text-sm text-warning">
          This lesson&rsquo;s text could not be read. Rewrite it from <Link href={`/admin/lessons/${current.topic.id}`}>its page</Link>.
          {next && (
            <>
              {" "}
              <Link href={`${here}?topic=${next.topicId}`}>Next lesson</Link>
            </>
          )}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Lesson {at + 1} of {toRead.length} to read · {REVIEW_STATUS_LABELS[current.lesson.status]}
            {current.lesson.bulkApproved ? " with its course (students see a note until it is read in full)" : ""} · version {current.lesson.version} ·{" "}
            <Link href={`/admin/lessons/${current.topic.id}`}>Full page with memory aids and sources</Link>
          </p>
          <ReadInFull
            key={`${current.lesson.id}-${current.lesson.version}`}
            lessonId={current.lesson.id}
            version={current.lesson.version}
            content={current.lesson.content}
            checkpoints={current.checkpoints}
            authorities={current.authorities}
            initialTicks={current.ticks}
            nextHref={next ? `${here}?topic=${next.topicId}` : null}
          />
        </>
      )}
    </>
  );
}
