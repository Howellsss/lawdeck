import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LibraryList } from "@/components/library/LibraryList";
import { UploadForm } from "@/components/library/UploadForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getStaffRole } from "@/server/auth/roles";
import { getSupabaseConfig } from "@/server/auth/config";
import { listLibraryItems } from "@/server/db/library";
import { listCourses } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Library · Lawdeck" };

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

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-normal text-greeting">Library</h1>
        <p className="text-muted">
          Source material for answers. Students never see these files; they only benefit from approved passages.
        </p>
      </div>
      {role === "admin" && courses.status === "ok" && <UploadForm courses={courses.data} apiKey={apiKey} />}
      <section aria-labelledby="library-items" className="flex flex-col gap-3">
        <h2 id="library-items" className="text-lg font-medium">
          Items ({items.length})
        </h2>
        <LibraryList items={items} canRemove={role === "admin"} />
      </section>
    </>
  );
}
