import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { RUBRIC_STATUS_LABELS } from "@/schemas/rubrics";
import { listRubrics } from "@/server/db/rubrics";

export const metadata: Metadata = { title: "Marking guides · Lawdeck" };

// Marking guides (step 4d): reviewers and admins only; everyone else gets "page not found".
export default function RubricsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading the marking guides" />}>
        <Rubrics />
      </Suspense>
    </div>
  );
}

async function Rubrics() {
  const rubrics = await listRubrics();
  if (!rubrics) notFound();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-normal text-greeting">Marking guides</h1>
        <Link href="/admin/rubrics/new" className={`${compactPrimaryButton} no-underline`}>
          New marking guide
        </Link>
      </div>
      <p className="text-muted">
        Each guide is an exam-style question with the points a good answer makes and their marks. Only approved guides are used to mark
        students’ answers.
      </p>
      {rubrics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">No marking guides yet. Write the first one.</p>
      ) : (
        <ul aria-label="Marking guides" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {rubrics.map((rubric) => (
            <li key={rubric.id} className="flex flex-col gap-1 px-4 py-3">
              <Link href={`/admin/rubrics/${rubric.id}`} className="break-words font-medium">
                {rubric.title}
              </Link>
              <span className="text-sm text-muted">
                {[rubric.courseName, rubric.topicName].filter(Boolean).join(" · ")} · {rubric.totalMarks} marks ·{" "}
                <span className={rubric.status === "approved" ? "text-success" : ""}>{RUBRIC_STATUS_LABELS[rubric.status]}</span> · updated{" "}
                {formatWat(rubric.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
