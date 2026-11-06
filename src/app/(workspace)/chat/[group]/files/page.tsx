import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatGate } from "@/components/chat/ChatGate";
import { ChatShell } from "@/components/chat/ChatShell";
import { SharedList } from "@/components/chat/SharedList";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { chatAllowed, getChatShared } from "@/server/chat/data";
import { getOwnCampus } from "@/server/db/campuses";

export const metadata: Metadata = { title: "Files and links · Campus chat · Lawdeck" };

const keySchema = z.string().regex(/^[a-z][a-z-]{1,39}$/);

// A group's Files & links tab (docs/specs/chat.md): files and web links shared there.
export default function ChatFilesPage({ params }: PageProps<"/chat/[group]/files">) {
  return (
    <Suspense fallback={<LoadingRows label="Loading files and links" />}>
      <Shared params={params} />
    </Suspense>
  );
}

async function Shared({ params }: { params: Promise<{ group: string }> }) {
  const key = keySchema.safeParse((await params).group);
  if (!key.success) notFound();
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="campus chat" returnTo={`/chat/${key.data}/files`} />;
  if (!(await chatAllowed())) return <ChatGate />;
  const [shared, campus] = await Promise.all([getChatShared(key.data), getOwnCampus()]);
  if (!shared) notFound();
  const campusName = shared.groups.find((g) => g.key === campus)?.name ?? null;
  return (
    <ChatShell groups={shared.groups} group={shared.group} tab="files" ownCampusName={campusName}>
      <SharedList items={shared.items} groupName={shared.group.name} />
    </ChatShell>
  );
}
