import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/Icon";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { listCourses } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Courses · Lawdeck" };

export default function CoursesPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-normal text-greeting">Courses</h1>
        <p className="text-muted">
          The five Bar Part II courses. Open one to see its topics and ask Lawdeck to explain any of them.
        </p>
      </div>
      <Suspense fallback={<LoadingRows label="Loading courses" rows={5} />}>
        <Courses />
      </Suspense>
    </div>
  );
}

async function Courses() {
  const result = await listCourses();
  if (result.status === "signed-out") return <SignInPrompt what="courses" returnTo="/courses" />;
  if (result.data.length === 0) return <p className="text-muted">No courses are set up yet.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {result.data.map((course) => (
        <li key={course.id}>
          <Link
            href={`/courses/${course.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4 hover:bg-pill"
          >
            <Icon name="book" className="text-muted" />
            <span className="text-[15px] font-medium underline underline-offset-2">{course.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
