import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LawChangeForm } from "@/components/library/LawChangeForm";
import { RemoveLawChangeButton } from "@/components/library/RemoveLawChangeButton";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatDateWat } from "@/lib/dates";
import { getStaffRole } from "@/server/auth/roles";
import { listLawChanges } from "@/server/db/lawChanges";
import { listCourses } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Law changes · Library · Lawdeck" };

export default function LawChangesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/admin/library" className="text-sm">
        All library items
      </Link>
      <Suspense fallback={<LoadingRows label="Loading law changes" />}>
        <LawChanges />
      </Suspense>
    </div>
  );
}

// Reviewers and admins only; everyone else gets "page not found".
async function LawChanges() {
  if (!(await getStaffRole())) notFound();
  const [changes, courses] = await Promise.all([listLawChanges(), listCourses()]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-normal text-greeting">Law changes</h1>
        <p className="text-muted">
          When the law changes, record it here. Library material checked only up to an earlier date, in the same course,
          is marked “Needs re-check” until a reviewer checks it again.
        </p>
      </div>
      {courses.status === "ok" && <LawChangeForm courses={courses.data} />}
      <section aria-labelledby="changes" className="flex flex-col gap-3">
        <h2 id="changes" className="text-lg font-medium">
          Recorded changes ({changes.length})
        </h2>
        {changes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
            No changes recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {changes.map((change) => (
              <li key={change.id} className="flex flex-col gap-1 px-4 py-4">
                <p className="break-words text-[15px] font-medium">{change.title}</p>
                <p className="text-sm text-muted">
                  {[change.courseName, `took effect ${formatDateWat(change.effectiveOn)}`, change.source].filter(Boolean).join(" · ")}
                </p>
                {change.note && <p className="text-sm">{change.note}</p>}
                <div className="pt-1">
                  <RemoveLawChangeButton id={change.id} title={change.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
