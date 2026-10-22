import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RubricForm } from "@/components/rubrics/RubricForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getStaffRole } from "@/server/auth/roles";
import { listCourseTopics } from "@/server/db/rubrics";

export const metadata: Metadata = { title: "New marking guide · Lawdeck" };

export default function NewRubricPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/admin/rubrics" className="text-sm">
        All marking guides
      </Link>
      <Suspense fallback={<LoadingRows label="Loading" />}>
        <NewRubric />
      </Suspense>
    </div>
  );
}

async function NewRubric() {
  if (!(await getStaffRole())) notFound();
  return (
    <>
      <h1 className="font-serif text-3xl font-normal text-greeting">New marking guide</h1>
      <RubricForm courses={await listCourseTopics()} />
    </>
  );
}
