import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { pagesLabel } from "@/lib/pages";
import { REVIEW_STATUS_LABELS, SOURCE_KIND_LABELS, SOURCE_RIGHTS_LABELS } from "@/lib/libraryLabels";
import { z } from "@/lib/zod";
import { getStaffRole } from "@/server/auth/roles";
import { getAnswerSources } from "@/server/db/sourcePresentation";

export const metadata: Metadata = { title: "Answer sources · Lawdeck" };

// Source tracing (migration 37), admins only: every library document and passage behind one
// student answer, with the original title, file, Drive link and pages that students never see.
// Everyone else gets "page not found".
export default function AnswerSourcesPage(props: PageProps<"/admin/answers/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Link href="/admin/reports" className="text-sm">
        Reports
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the sources" />}>
        <AnswerSources {...props} />
      </Suspense>
    </div>
  );
}

async function AnswerSources({ params }: PageProps<"/admin/answers/[id]">) {
  if ((await getStaffRole()) !== "admin") notFound();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sources = await getAnswerSources(id);
  if (!sources) notFound();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Sources behind this answer</h1>
        <p className="text-muted">
          What the student saw, and the original document and passage behind each source. The student&apos;s own uploads are not listed.
        </p>
      </div>
      {sources.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          This answer cited no library passage.
        </p>
      ) : (
        <ol aria-label="Sources" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {sources.map((source) => (
            <li key={source.label} className="flex flex-col gap-2 px-4 py-4">
              <p className="text-sm text-muted">Source {source.label} · students saw “{source.studentLabel}”</p>
              {source.itemId ? (
                <>
                  <Link href={`/admin/library/${source.itemId}`} className="break-words font-medium">
                    {source.originalTitle}
                  </Link>
                  <p className="break-all text-sm text-muted">
                    {[
                      source.fileName,
                      source.heading,
                      pagesLabel(source.pageFrom, source.pageTo),
                      source.kind && SOURCE_KIND_LABELS[source.kind],
                      source.rightsStatus && SOURCE_RIGHTS_LABELS[source.rightsStatus],
                      source.reviewStatus && REVIEW_STATUS_LABELS[source.reviewStatus as keyof typeof REVIEW_STATUS_LABELS],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {source.driveSource && <p className="break-all text-sm text-muted">Original: {source.driveSource}</p>}
                  {source.passageText && (
                    <details className="text-sm">
                      <summary className="cursor-pointer">The passage</summary>
                      <p className="mt-2 whitespace-pre-line break-words">{source.passageText}</p>
                    </details>
                  )}
                </>
              ) : (
                <p className="text-sm text-warning">The passage has since been removed from the library.</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
