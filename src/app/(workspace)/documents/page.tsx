import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { listDocuments } from "@/server/db/documents";

export const metadata: Metadata = { title: "Documents · Lawdeck" };

// The student's drafted documents, newest first. Only the owner ever sees them.
export default function DocumentsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Documents</h1>
      <Suspense fallback={<LoadingRows label="Loading your documents" />}>
        <Documents />
      </Suspense>
    </div>
  );
}

async function Documents() {
  const result = await listDocuments();
  if (result.status === "signed-out") return <SignInPrompt what="documents" returnTo="/documents" />;
  return (
    <>
      <p className="text-muted">
        Documents you draft are kept here, private to your account. <Link href="/drafting">Draft a new document</Link>.
      </p>
      {result.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No documents yet. Documents you draft will appear here.
        </p>
      ) : (
        <ul aria-label="Your documents" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {result.data.map((document) => (
            <li key={document.id} className="flex flex-col gap-1 px-4 py-3">
              <Link href={`/documents/${document.id}`} className="break-words font-medium">
                {document.title}
              </Link>
              <span className="text-sm text-muted">
                {[document.forumName, formatWat(document.updatedAt)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
