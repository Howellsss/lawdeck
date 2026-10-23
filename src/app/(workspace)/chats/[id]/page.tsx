import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExportButtons } from "@/components/exports/ExportButtons";
import { ChatThread } from "@/components/learn/ChatThread";
import { UseUploadsSwitch } from "@/components/learn/UseUploadsSwitch";
import { QuestionAllowance } from "@/components/learn/QuestionAllowance";
import { RoutedChip } from "@/components/learn/RoutedChip";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { getChat } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Chat · Lawdeck" };

// A Learn chat: its messages, sourced answers and the next-question box (Phase 3).
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
  if (result.status === "signed-out")
    return <SignInPrompt level={1} what="chats" returnTo={`/chats/${id}`} />;
  if (!result.data) notFound();
  const { chat, messages } = result.data;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">
          {chat.title}
        </h1>
        <p className="text-sm text-muted">{chat.courseName ?? "All courses"}</p>
        {chat.autoRouted && <RoutedChip />}
      </div>
      {chat.hasReadyUploads && (
        <UseUploadsSwitch chatId={chat.id} initial={chat.useUploads} />
      )}
      <ChatThread chatId={chat.id} initialMessages={messages} />
      <Suspense fallback={null}>
        <QuestionAllowance />
      </Suspense>
      {messages.length > 0 && <ExportButtons kind="chat" id={chat.id} />}
    </>
  );
}
