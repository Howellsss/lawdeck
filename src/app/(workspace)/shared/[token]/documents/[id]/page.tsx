import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OpenShare } from "@/components/sharing/OpenShare";
import { SharedDocumentView } from "@/components/sharing/SharedDocumentView";
import { SharedNotice } from "@/components/sharing/SharedNotice";
import { LoadingRows } from "@/components/ui/LoadingRows";

export const metadata: Metadata = { title: "Shared document · Lawdeck", robots: { index: false } };

// A document inside a shared project, read-only.
export default function SharedProjectDocumentPage({ params }: PageProps<"/shared/[token]/documents/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Opening the document" />}>
        <SharedProjectDocument params={params} />
      </Suspense>
    </div>
  );
}

async function SharedProjectDocument({ params }: Pick<PageProps<"/shared/[token]/documents/[id]">, "params">) {
  const { token, id } = await params;
  return (
    <OpenShare token={token} returnTo={`/shared/${token}/documents/${id}`}>
      {(share) => {
        if (share.kind !== "project") notFound();
        return (
          <>
            <Link href={`/shared/${token}`} className="text-sm">
              Back to {share.title}
            </Link>
            <SharedNotice isOwner={share.isOwner} sharedAt={share.sharedAt} />
            <SharedDocumentView token={token} id={id} />
          </>
        );
      }}
    </OpenShare>
  );
}
