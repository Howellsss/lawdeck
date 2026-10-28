import type { Metadata } from "next";
import { Suspense } from "react";
import { ItemList } from "@/components/projects/ItemList";
import { OpenShare } from "@/components/sharing/OpenShare";
import { SharedDocumentView } from "@/components/sharing/SharedDocumentView";
import { SharedNotice } from "@/components/sharing/SharedNotice";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { listSharedItems } from "@/server/db/sharing";

export const metadata: Metadata = { title: "Shared with you · Lawdeck", robots: { index: false } };

// A view-only share link (PRD EX-04): a shared document's pages, or a shared project's
// documents and chats. Only signed-in Lawdeck users can open it.
export default function SharedPage({ params }: PageProps<"/shared/[token]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Opening the shared work" />}>
        <Shared params={params} />
      </Suspense>
    </div>
  );
}

async function Shared({ params }: Pick<PageProps<"/shared/[token]">, "params">) {
  const { token } = await params;
  return (
    <OpenShare token={token} returnTo={`/shared/${token}`}>
      {(share) => (
        <>
          <SharedNotice isOwner={share.isOwner} sharedAt={share.sharedAt} />
          {share.kind === "document" && share.documentId ? (
            <SharedDocumentView token={token} id={share.documentId} />
          ) : (
            <>
              <h1 className="break-words font-serif text-3xl font-normal text-greeting">{share.title}</h1>
              <ProjectItems token={token} />
            </>
          )}
        </>
      )}
    </OpenShare>
  );
}

async function ProjectItems({ token }: { token: string }) {
  const items = await listSharedItems(token);
  const documents = items.filter((item) => item.kind === "document");
  const chats = items.filter((item) => item.kind === "chat");
  if (items.length === 0)
    return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">This project is empty for now.</p>;
  return (
    <>
      {documents.length > 0 && (
        <section aria-labelledby="shared-documents" className="flex flex-col gap-3">
          <h2 id="shared-documents" className="text-lg font-medium">
            Documents
          </h2>
          <ItemList
            label="Shared documents"
            icon="document"
            items={documents.map((d) => ({ id: d.id, name: d.title, updatedAt: d.updatedAt }))}
            hrefFor={(id) => `/shared/${token}/documents/${id}`}
          />
        </section>
      )}
      {chats.length > 0 && (
        <section aria-labelledby="shared-chats" className="flex flex-col gap-3">
          <h2 id="shared-chats" className="text-lg font-medium">
            Chats
          </h2>
          <ItemList
            label="Shared chats"
            icon="chat"
            items={chats.map((c) => ({ id: c.id, name: c.title, updatedAt: c.updatedAt }))}
            hrefFor={(id) => `/shared/${token}/chats/${id}`}
          />
        </section>
      )}
    </>
  );
}
