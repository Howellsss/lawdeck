import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { listLessonOverview } from "@/server/db/lessons";

export const metadata: Metadata = { title: "Lessons · Lawdeck" };

// Admin → Lessons (docs/specs/remembrance.md): every topic of the five courses, with its lesson's
// state. Reviewers and admins only; everyone else gets "page not found".
export default function LessonsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the topics" />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const overview = await listLessonOverview();
  if (!overview) notFound();
  const all = overview.courses.flatMap((course) => course.topics);
  const approved = all.filter((topic) => topic.lesson?.status === "approved").length;
  const waiting = all.filter((topic) => topic.lesson?.status === "pending").length;
  return (
    <>
      <h1 className="font-serif text-3xl font-normal text-greeting">Lessons</h1>
      <p className="text-muted">
        Each topic gets one lesson, written by Lawdeck from the approved library, with recall questions and authority cards. Students
        only see a lesson after you approve it; any change sends it back for review.
      </p>
      <p className="text-sm text-muted">
        {all.length} topics · {approved} approved · {waiting} awaiting review · {all.length - all.filter((t) => t.lesson).length} not written yet
      </p>
      {overview.courses.map((course) => (
        <section key={course.id} aria-labelledby={`course-${course.id}`} className="flex flex-col gap-2">
          <h2 id={`course-${course.id}`} className="font-serif text-2xl font-normal">
            {course.name}
          </h2>
          {course.topics.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">
              No topics yet. Add them on the course&rsquo;s page under Courses.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
              {course.topics.map((topic) => (
                <li key={topic.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <Link href={`/admin/lessons/${topic.id}`} className="font-medium">
                    {topic.name}
                  </Link>
                  <span className={`text-sm ${topic.lesson?.status === "approved" ? "text-success" : "text-muted"}`}>
                    {topic.lesson
                      ? `${REVIEW_STATUS_LABELS[topic.lesson.status]} · version ${topic.lesson.version} · ${formatWat(topic.lesson.updatedAt)}`
                      : "Not written yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
