import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SearchTest } from "@/components/library/SearchTest";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getStaffRole } from "@/server/auth/roles";
import { listCourses } from "@/server/db/workspace";
import { EMBEDDING_MODEL, EMBEDDING_MODELS } from "@/server/retrieval/settings";

export const metadata: Metadata = { title: "Test the search · Lawdeck" };

export default function LibrarySearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading" />}>
        <SearchPage />
      </Suspense>
    </div>
  );
}

// Reviewers and admins only; everyone else gets "page not found".
async function SearchPage() {
  if (!(await getStaffRole())) notFound();
  const courses = await listCourses();

  return (
    <>
      <div className="flex flex-col gap-2">
        <p>
          <Link href="/admin/library" className="text-sm underline underline-offset-2">
            Back to the Library
          </Link>
        </p>
        <h1 className="font-serif text-3xl font-normal text-greeting">Test the search</h1>
        <p className="text-muted">
          Ask a question the way a student would and see which passages come back, by meaning and by exact words.
          Search model: {EMBEDDING_MODELS[EMBEDDING_MODEL].label}.
        </p>
      </div>
      {courses.status === "ok" ? (
        <SearchTest courses={courses.data} />
      ) : (
        <p role="alert" className="text-warning">
          The courses could not be loaded. Refresh the page to try again.
        </p>
      )}
    </>
  );
}
