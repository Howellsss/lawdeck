import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RubricForm } from "@/components/rubrics/RubricForm";
import { RubricStatusBar } from "@/components/rubrics/RubricStatusBar";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getStaffRole } from "@/server/auth/roles";
import { getRubric, listCourseTopics } from "@/server/db/rubrics";

export const metadata: Metadata = { title: "Marking guide · Lawdeck" };

export default function RubricPage({ params }: PageProps<"/admin/rubrics/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Link href="/admin/rubrics" className="text-sm">
        All marking guides
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the guide" />}>
        <Rubric params={params} />
      </Suspense>
    </div>
  );
}

async function Rubric({ params }: Pick<PageProps<"/admin/rubrics/[id]">, "params">) {
  const role = await getStaffRole();
  if (!role) notFound();
  const { id } = await params;
  const [rubric, courses] = await Promise.all([getRubric(id), listCourseTopics()]);
  if (!rubric) notFound();
  return (
    <>
      <h1 className="break-words font-serif text-3xl font-normal text-greeting">{rubric.title}</h1>
      <RubricStatusBar id={rubric.id} status={rubric.status} isAdmin={role === "admin"} />
      <RubricForm key={`${rubric.id}-${rubric.status}`} courses={courses} rubric={rubric} />
    </>
  );
}
