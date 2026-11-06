import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ChatShell } from "@/components/chat/ChatShell";
import type { ChatMessage } from "@/server/chat/data";
import { groups, invites } from "../chatSample";
import { testPagesEnabled } from "../sample";

// Study group conversation test only (tests/voice/chat.spec.ts): a made-up voice note and the
// record button, which only study groups have. "Not found" unless LAWDECK_TEST_PAGES=1.
const study = groups.find((g) => g.kind === "study") ?? groups[0];
const messages: ChatMessage[] = [
  {
    id: "00000000-0000-4000-8000-000000000861",
    groupId: study.id,
    body: "Quick summary of Order 3 for tonight",
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    author: { id: "00000000-0000-4000-8000-000000000812", name: "Tunde Quokka", campus: "Abuja" },
    mine: false,
    files: [{ name: "Voice note", kind: "voice", size: 48_000, url: null, seconds: 42 }],
  },
];

export default function TestChatStudyPage() {
  return (
    <Suspense fallback={null}>
      <TestChatStudy />
    </Suspense>
  );
}

async function TestChatStudy() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <ChatShell groups={groups} group={study} ownCampusName="Lagos" invites={invites}>
      <ChatRoom groupId={study.id} groupName={study.name} initial={messages} initialHasOlder={false} voiceNotes apiKey="test" />
    </ChatShell>
  );
}
