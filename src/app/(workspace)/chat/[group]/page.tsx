import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatGate } from "@/components/chat/ChatGate";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ChatRules } from "@/components/chat/ChatRules";
import { ChatShell } from "@/components/chat/ChatShell";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { getSupabaseConfig } from "@/server/auth/config";
import { chatAllowed, getChatRoom, type ChatGroup } from "@/server/chat/data";

export const metadata: Metadata = { title: "Campus chat · Lawdeck" };

const keySchema = z.string().regex(/^[a-z][a-z-]{1,39}$/);

const SUBTITLES: Record<ChatGroup["kind"], (name: string) => string> = {
  all: () => "Students from every campus · everyone can read and post",
  campus: (name) => `${name} campus · everyone can read and post`,
  aspirants: () => "Final-year students preparing for Law School",
};

// One chat group (docs/specs/chat.md): its conversation, or the community rules first.
export default function ChatGroupPage({ params }: PageProps<"/chat/[group]">) {
  return (
    <Suspense fallback={<LoadingRows label="Loading the conversation" />}>
      <Group params={params} />
    </Suspense>
  );
}

async function Group({ params }: { params: Promise<{ group: string }> }) {
  const key = keySchema.safeParse((await params).group);
  if (!key.success) notFound();
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="campus chat" returnTo={`/chat/${key.data}`} />;
  if (!(await chatAllowed())) return <ChatGate />;
  const room = await getChatRoom(key.data);
  if (!room) notFound();
  return (
    <ChatShell groups={room.groups} current={room.group.key} title={room.group.name} subtitle={SUBTITLES[room.group.kind](room.group.name)} ownCampusName={room.me.campus}>
      {room.member ? (
        <ChatRoom key={room.group.id} groupId={room.group.id} groupName={room.group.name} initial={room.messages} initialHasOlder={room.hasOlder} isAdmin={room.isAdmin} apiKey={getSupabaseConfig()?.key ?? ""} />
      ) : (
        <ChatRules />
      )}
    </ChatShell>
  );
}
