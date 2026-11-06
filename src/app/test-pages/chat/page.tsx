import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ChatShell } from "@/components/chat/ChatShell";
import { groupId, groups, invites, messages } from "../chatSample";
import { testPagesEnabled } from "../sample";

// Campus chat test only (tests/voice/chat.spec.ts): made-up people and messages, to check the
// layout, formatting and message box on phones and desktops. Sending needs an account, so here it
// shows the sign-in message. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
export default function TestChatPage() {
  return (
    <Suspense fallback={null}>
      <TestChat />
    </Suspense>
  );
}

async function TestChat() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <ChatShell groups={groups} group={groups[1]} ownCampusName="Lagos" invites={invites}>
      <ChatRoom groupId={groupId} groupName="Lagos" initial={messages} initialHasOlder apiKey="test" />
    </ChatShell>
  );
}
