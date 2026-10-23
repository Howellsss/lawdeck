import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteDocumentButton } from "@/components/draft/DeleteDocumentButton";
import { DocumentChecks } from "@/components/draft/DocumentChecks";
import { DocumentSheet } from "@/components/draft/DocumentSheet";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatWat } from "@/lib/dates";
import { getDocument } from "@/server/db/documents";

export const metadata: Metadata = { title: "Document · Lawdeck" };

// One drafted document: the automatic checks, the document as it will print, and the Word file.
// Editing in the side panel and versions come in step 5e.
export default function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/documents" className="text-sm">
        All documents
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the document" />}>
        <DocumentView params={params} />
      </Suspense>
    </div>
  );
}

async function DocumentView({ params }: Pick<PageProps<"/documents/[id]">, "params">) {
  const { id } = await params;
  const result = await getDocument(id);
  if (result.status === "signed-out") return <SignInPrompt level={1} what="documents" returnTo={`/documents/${id}`} />;
  if (!result.data) notFound();
  const document = result.data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">{document.title}</h1>
        <p className="text-sm text-muted">{[document.forumName, formatWat(document.createdAt)].filter(Boolean).join(" · ")}</p>
      </div>
      {document.model ? (
        <>
          <DocumentChecks issues={document.issues} />
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/api/documents/${document.id}/docx`} download className={compactPrimaryButton}>
              Download Word file
            </a>
            <span className="text-sm text-muted">Placeholders in grey boxes are facts still to add.</span>
          </div>
          <DocumentSheet model={document.model} />
        </>
      ) : (
        <StateMessage level={2} title="Being re-checked">
          The template or court format for this document is being reviewed again, so it can’t be shown just now. Your facts and text
          are saved. Please check back later.
        </StateMessage>
      )}
      <DeleteDocumentButton id={document.id} />
    </>
  );
}
