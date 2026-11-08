import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DriveImport } from "@/components/library/DriveImport";
import { testPagesEnabled } from "../sample";

// Library "paste Drive links" and "Apply to all" test only (tests/voice/library.spec.ts): made-up
// files, no Google. "Not found" unless LAWDECK_TEST_PAGES=1.
const courses = [
  { id: "00000000-0000-4000-8000-000000000901", name: "Civil Litigation" },
  { id: "00000000-0000-4000-8000-000000000902", name: "Property Law" },
];
const files = [
  { id: "file-aaaaaaaa", name: "Week 1 notes.pdf", sizeBytes: 1_200_000 },
  { id: "file-bbbbbbbb", name: "Week 2 notes.docx", sizeBytes: 800_000 },
];

export default function TestDriveLinksPage() {
  return (
    <Suspense fallback={null}>
      <TestDriveLinks />
    </Suspense>
  );
}

async function TestDriveLinks() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <DriveImport config={null} courses={courses} links initialFiles={files} />
    </div>
  );
}
