import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TopicList } from "@/components/courses/TopicList";
import { TopicsEditor } from "@/components/courses/TopicsEditor";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { getStaffRole } from "@/server/auth/roles";
import { getCourseHub } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Course · Lawdeck" };

// A course hub (PRD LN-05): the course's topics in teaching order; choosing one starts an
// explanation. Admins also manage the topics here.
export default function CourseHubPage({ params }: PageProps<"/courses/[slug]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the course" />}>
        <Hub params={params} />
      </Suspense>
    </div>
  );
}

async function Hub({ params }: Pick<PageProps<"/courses/[slug]">, "params">) {
  const { slug } = await params;
  const result = await getCourseHub(slug);
  if (result.status === "signed-out") return <SignInPrompt level={1} what="courses" returnTo={`/courses/${slug}`} />;
  if (!result.data) notFound();
  const { course, topics } = result.data;
  const isAdmin = (await getStaffRole()) === "admin";

  return (
    <>
      <div className="flex flex-col gap-2">
        <p>
          <Link href="/courses" className="text-sm underline underline-offset-2">
            All courses
          </Link>
        </p>
        <h1 className="font-serif text-3xl font-normal text-greeting">{course.name}</h1>
        <p className="text-muted">Choose a topic: Lawdeck explains it, or makes multiple-choice questions (MCQ) on it, from approved course material.</p>
      </div>
      <TopicList courseSlug={course.slug} topics={topics} />
      {isAdmin && <TopicsEditor courseId={course.id} topics={topics} />}
    </>
  );
}
