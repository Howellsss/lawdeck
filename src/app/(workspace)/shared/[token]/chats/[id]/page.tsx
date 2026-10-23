import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OpenShare } from "@/components/sharing/OpenShare";
import { SharedChatView } from "@/components/sharing/SharedChatView";
import { SharedNotice } from "@/components/sharing/SharedNotice";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getSharedChat, listSharedItems } from "@/server/db/sharing";

export const metadata: Metadata = { title: "Shared chat · Lawdeck", robots: { index: false } };

// A chat inside a shared project, read-only.
export default function SharedChatPage({ params }: PageProps<"/shared/[token]/chats/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Opening the chat" />}>
        <SharedChat params={params} />
      </Suspense>
    </div>
  );
}

async function SharedChat({ params }: Pick<PageProps<"/shared/[token]/chats/[id]">, "params">) {
  const { token, id } = await params;
  return (
    <OpenShare token={token} returnTo={`/shared/${token}/chats/${id}`}>
      {async (share) => {
        if (share.kind !== "project") notFound();
        const [items, messages] = await Promise.all([listSharedItems(token), getSharedChat(token, id)]);
        const chat = items.find((item) => item.kind === "chat" && item.id === id);
        if (!chat) notFound();
        return (
          <>
            <Link href={`/shared/${token}`} className="text-sm">
              Back to {share.title}
            </Link>
            <SharedNotice isOwner={share.isOwner} sharedAt={share.sharedAt} />
            <h1 className="break-words font-serif text-3xl font-normal text-greeting">{chat.title}</h1>
            <SharedChatView messages={messages} />
          </>
        );
      }}
    </OpenShare>
  );
}
