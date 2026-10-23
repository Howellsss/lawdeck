import type { Metadata } from "next";
import { Suspense } from "react";
import { StateMessage } from "@/components/ui/StateMessage";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { UploadList } from "@/components/uploads/UploadList";
import { UploadNotice } from "@/components/uploads/UploadNotice";
import { UploadPicker } from "@/components/uploads/UploadPicker";
import { getSupabaseConfig } from "@/server/auth/config";
import { getUploadsPage } from "@/server/db/uploads";

export const metadata: Metadata = { title: "My uploads · Lawdeck" };

// A student's own study material (Phase 6, step 6a): private to them, never part of the library.
export default function UploadsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading your uploads" />}>
        <Uploads />
      </Suspense>
    </div>
  );
}

async function Uploads() {
  const page = await getUploadsPage();
  if (!page)
    return (
      <StateMessage title="Sign in to upload" action={{ label: "Sign in", href: "/sign-in?next=/uploads" }}>
        Upload your own notes and handouts to study from them privately.
      </StateMessage>
    );
  const apiKey = getSupabaseConfig()?.key ?? "";
  const full = page.fileLimit !== null && page.files.length >= page.fileLimit;
  return (
    <>
      <h1 className="font-serif text-3xl font-normal text-greeting">My uploads</h1>
      <p className="text-muted">
        Your own notes, handouts and past answers. Only you can see them.
        {page.fileLimit !== null ? ` ${page.files.length} of ${page.fileLimit} files used.` : ""}
      </p>
      {page.noticeAccepted ? <UploadPicker apiKey={apiKey} full={full} /> : <UploadNotice />}
      <UploadList files={page.files} />
    </>
  );
}
