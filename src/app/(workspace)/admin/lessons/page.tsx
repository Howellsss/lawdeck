import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApproveCourseButton } from "@/components/lessons/ApproveCourseButton";
import { BulkWriteLessons } from "@/components/lessons/BulkWriteLessons";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { needsReading } from "@/lib/readInFull";
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

// Lessons still to read in full: awaiting review, or approved with their course.
const toRead = (course: { topics: { lesson: { status: string; bulkApproved: boolean } | null }[] }) =>
  course.topics.filter((t) => t.lesson && needsReading({ status: t.lesson.status, bulk_approved: t.lesson.bulkApproved })).length;

async function Overview() {
  const overview = await listLessonOverview();
  if (!overview) notFound();
  const all = overview.courses.flatMap((course) => course.topics);
  const approved = all.filter((topic) => topic.lesson?.status === "approved").length;
  const waiting = all.filter((topic) => topic.lesson?.status === "pending").length;
  const missing = overview.courses.flatMap((course) =>
    course.topics.filter((topic) => !topic.lesson).map((topic) => ({ id: topic.id, name: topic.name, courseId: course.id, courseName: course.name })),
  );
  const missingExtras = overview.courses.flatMap((course) =>
    course.topics
      .filter((topic) => topic.lesson && !topic.extras)
      .map((topic) => ({ id: topic.id, name: topic.name, courseId: course.id, courseName: course.name })),
  );
  const withNewMaterial = overview.courses.flatMap((course) =>
    course.topics
      .filter((topic) => topic.lesson?.newMaterial)
      .map((topic) => ({ id: topic.id, name: topic.name, courseId: course.id, courseName: course.name })),
  );
  const courseList = overview.courses.map((c) => ({ id: c.id, name: c.name }));
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
      <BulkWriteLessons topics={missing} courses={courseList} />
      {withNewMaterial.length > 0 && <BulkWriteLessons topics={withNewMaterial} courses={courseList} kind="update" />}
      {all.some((t) => t.lesson) && <BulkWriteLessons topics={missingExtras} courses={courseList} kind="extras" />}
      {overview.courses.map((course) => (
        <section key={course.id} aria-labelledby={`course-${course.id}`} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`course-${course.id}`} className="font-serif text-2xl font-normal">
              {course.name}
            </h2>
            <div className="flex flex-wrap items-start gap-2">
              {toRead(course) > 0 && (
                <Link
                  href={`/admin/lessons/read/${course.id}`}
                  className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13.5px] font-medium text-on-ink no-underline"
                >
                  Read in full ({toRead(course)} to read)
                </Link>
              )}
              {course.topics.some((t) => t.extras?.status === "pending") && (
                <ApproveCourseButton
                  courseId={course.id}
                  courseName={course.name}
                  waiting={course.topics.filter((t) => t.extras?.status === "pending").length}
                />
              )}
            </div>
          </div>
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
                      ? `${REVIEW_STATUS_LABELS[topic.lesson.status]}${topic.lesson.bulkApproved ? " with course" : ""} · version ${topic.lesson.version} · ${formatWat(topic.lesson.updatedAt)}`
                      : "Not written yet"}
                    {topic.lesson?.approvedBehind ? " · students read the approved version meanwhile" : ""}
                    {topic.lesson?.newMaterial ? " · new library material" : ""}
                    {topic.extras
                      ? ` · memory aids ${REVIEW_STATUS_LABELS[topic.extras.status].toLowerCase()}${topic.extras.bulkApproved ? " with course" : ""}`
                      : topic.lesson
                        ? " · no memory aids yet"
                        : ""}
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
