import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LibraryList } from "@/components/library/LibraryList";
import { DriveImport } from "@/components/library/DriveImport";
import { UploadForm } from "@/components/library/UploadForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { libraryFilterSchema } from "@/schemas/libraryReview";
import { getRecheckReasons } from "@/server/db/lawChanges";
import { getStaffRole } from "@/server/auth/roles";
import { getSupabaseConfig } from "@/server/auth/config";
import { listLibraryItems } from "@/server/db/library";
import { getDrivePickerConfig } from "@/server/library/driveConfig";
import { listCourses } from "@/server/db/workspace";
import { EMBEDDING_MODEL } from "@/server/retrieval/settings";
import { getSourceFlags } from "@/server/db/sourcePresentation";

export const metadata: Metadata = { title: "Library · Lawdeck" };
// Reading a file is done by server actions on this page, in steps of up to about 3 minutes.
export const maxDuration = 300;

export default function LibraryAdminPage({ searchParams }: PageProps<"/admin/library">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading the library" />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Only reviewers and admins may see this page; everyone else gets "page not found".
async function Library({ searchParams }: Pick<PageProps<"/admin/library">, "searchParams">) {
  const role = await getStaffRole();
  if (!role) notFound();
  const filter = libraryFilterSchema.parse((await searchParams).status);
  const status = filter === "recheck" ? undefined : filter;
  const [allItems, courses, recheck] = await Promise.all([listLibraryItems(status), listCourses(), getRecheckReasons()]);
  const items = filter === "recheck" ? allItems.filter((item) => recheck.has(item.id)) : allItems;
  const apiKey = getSupabaseConfig()?.key ?? "";
  const drive = role === "admin" ? getDrivePickerConfig() : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-normal text-greeting">Library</h1>
        <p className="text-muted">
          Source material for answers. Students never see these files; they only benefit from approved passages.
        </p>
        <p>
          <Link href="/admin/library/search" className="underline underline-offset-2">
            Test the search
          </Link>
          {" · "}
          <Link href="/admin/library/law-changes" className="underline underline-offset-2">
            Law changes
          </Link>
        </p>
      </div>
      {drive && courses.status === "ok" && <DriveImport config={drive} courses={courses.data} />}
      {role === "admin" && courses.status === "ok" && <UploadForm courses={courses.data} apiKey={apiKey} />}
      <section aria-labelledby="library-items" className="flex flex-col gap-3">
        <h2 id="library-items" className="text-lg font-medium">
          {filter === "recheck" ? "Needs re-check" : status ? REVIEW_STATUS_LABELS[status] : "All items"} ({items.length})
        </h2>
        <nav aria-label="Filter by review status" className="flex flex-wrap gap-2 text-sm">
          {([undefined, "pending", "approved", "rejected", "withdrawn", "recheck"] as const).map((value) => (
            <Link
              key={value ?? "all"}
              href={value ? `/admin/library?status=${value}` : "/admin/library"}
              aria-current={value === filter ? "page" : undefined}
              className={`rounded-full border border-line px-3 py-1.5 no-underline ${value === filter ? "bg-pill font-medium" : "hover:bg-pill"}`}
            >
              {value === "recheck" ? `Needs re-check (${recheck.size})` : value ? REVIEW_STATUS_LABELS[value] : "All"}
            </Link>
          ))}
        </nav>
        <LibraryList items={items} isAdmin={role === "admin"} currentModel={EMBEDDING_MODEL} recheck={recheck} flags={await getSourceFlags()} />
      </section>
    </>
  );
}
