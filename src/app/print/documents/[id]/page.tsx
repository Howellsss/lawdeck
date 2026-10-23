import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintPages } from "@/components/draft/preview/PrintPages";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { StateMessage } from "@/components/ui/StateMessage";
import { getDocument } from "@/server/db/documents";

export const metadata: Metadata = { title: "Save as PDF · Lawdeck" };

// The student's document as pages only, for printing or saving as PDF (PRD EX-02). Outside the
// workspace so nothing else prints. Sign-in and ownership are checked as on the document page.
export default function PrintDocumentPage({ params }: PageProps<"/print/documents/[id]">) {
  return (
    <Suspense fallback={<LoadingRows label="Preparing the pages" />}>
      <PrintView params={params} />
    </Suspense>
  );
}

async function PrintView({ params }: Pick<PageProps<"/print/documents/[id]">, "params">) {
  const { id } = await params;
  const result = await getDocument(id);
  if (result.status === "signed-out") return <SignInPrompt level={1} what="documents" returnTo={`/print/documents/${id}`} />;
  if (!result.data) notFound();
  if (!result.data.model)
    return (
      <StateMessage title="Being re-checked" action={{ label: "Back to the document", href: `/documents/${id}` }}>
        This document’s template or court format is being reviewed again, so it can’t be printed just now.
      </StateMessage>
    );
  return <PrintPages model={result.data.model} backHref={`/documents/${id}`} autoPrint />;
}
