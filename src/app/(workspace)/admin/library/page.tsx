import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LibraryList } from "@/components/library/LibraryList";
import { DriveImport } from "@/components/library/DriveImport";
import { UploadForm } from "@/components/library/UploadForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getStaffRole } from "@/server/auth/roles";
import { getSupabaseConfig } from "@/server/auth/config";
import { listLibraryItems } from "@/server/db/library";
import { getDrivePickerConfig } from "@/server/library/driveConfig";
import { listCourses } from "@/server/db/workspace";
import { EMBEDDING_MODEL } from "@/server/retrieval/settings";

export const metadata: Metadata = { title: "Library · Lawdeck" };
// Reading a file is done by server actions on this page, in steps of up to about 3 minutes.
export const maxDuration = 300;

export default function LibraryAdminPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading the library" />}>
        <Library />
      </Suspense>
    </div>
  );
}

// Only reviewers and admins may see this page; everyone else gets "page not found".
async function Library() {
  const role = await getStaffRole();
  if (!role) notFound();
  const [items, courses] = await Promise.all([listLibraryItems(), listCourses()]);
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
        </p>
      </div>
      {drive && courses.status === "ok" && <DriveImport config={drive} courses={courses.data} />}
      {role === "admin" && courses.status === "ok" && <UploadForm courses={courses.data} apiKey={apiKey} />}
      <section aria-labelledby="library-items" className="flex flex-col gap-3">
        <h2 id="library-items" className="text-lg font-medium">
          Items ({items.length})
        </h2>
        <LibraryList items={items} isAdmin={role === "admin"} currentModel={EMBEDDING_MODEL} />
      </section>
    </>
  );
}
