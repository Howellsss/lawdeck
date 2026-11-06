import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatGate } from "@/components/chat/ChatGate";
import { ChatShell } from "@/components/chat/ChatShell";
import { MembersPanel } from "@/components/chat/MembersPanel";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { chatAllowed, getChatMembers } from "@/server/chat/data";
import { getOwnCampus } from "@/server/db/campuses";

export const metadata: Metadata = { title: "Members · Campus chat · Lawdeck" };

const keySchema = z.string().regex(/^[a-z][a-z-]{1,39}$/);

// A study group's Members tab (docs/specs/chat.md): members, invitations and group settings.
export default function ChatMembersPage({ params }: PageProps<"/chat/[group]/members">) {
  return (
    <Suspense fallback={<LoadingRows label="Loading members" />}>
      <Members params={params} />
    </Suspense>
  );
}

async function Members({ params }: { params: Promise<{ group: string }> }) {
  const key = keySchema.safeParse((await params).group);
  if (!key.success) notFound();
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="campus chat" returnTo={`/chat/${key.data}/members`} />;
  if (!(await chatAllowed())) return <ChatGate />;
  const [page, campus] = await Promise.all([getChatMembers(key.data), getOwnCampus()]);
  if (!page) notFound();
  const campusName = page.groups.find((g) => g.key === campus)?.name ?? null;
  return (
    <ChatShell groups={page.groups} group={page.group} tab="members" ownCampusName={campusName} invites={page.invites}>
      <MembersPanel group={page.group} people={page.people} me={page.me} linkUntil={page.linkUntil} />
    </ChatShell>
  );
}
