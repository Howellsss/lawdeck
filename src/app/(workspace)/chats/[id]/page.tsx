import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { getChat } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Chat · Lawdeck" };

// Read-only view of a saved chat. Asking and answering arrive in Phase 3.
export default function ChatPage({ params }: PageProps<"/chats/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading the chat" />}>
        <Chat params={params} />
      </Suspense>
    </div>
  );
}

async function Chat({ params }: Pick<PageProps<"/chats/[id]">, "params">) {
  const { id } = await params;
  const result = await getChat(id);
  if (result.status === "signed-out") return <SignInPrompt level={1} what="chats" returnTo={`/chats/${id}`} />;
  if (!result.data) notFound();
  const { chat, messages } = result.data;

  return (
    <>
      <h1 className="break-words font-serif text-3xl font-normal text-greeting">{chat.title}</h1>
      {messages.length === 0 ? (
        <p className="text-muted">This chat has no messages yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                message.role === "user" ? "self-end bg-pill" : "border border-line"
              }`}
            >
              <span className="sr-only">{message.role === "user" ? "You" : "Lawdeck"}: </span>
              <span className="whitespace-pre-wrap break-words">{message.text}</span>
              <span className="mt-1 block text-xs text-muted">{formatWat(message.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
