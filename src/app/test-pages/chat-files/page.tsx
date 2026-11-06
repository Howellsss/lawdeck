import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatShell } from "@/components/chat/ChatShell";
import { SharedList } from "@/components/chat/SharedList";
import { groups, messages } from "../chatSample";
import { testPagesEnabled } from "../sample";

// Campus chat "Files & links" test only (tests/voice/chat.spec.ts): made-up files and links, to
// check the layout on phones and desktops. "Not found" unless LAWDECK_TEST_PAGES=1.
export default function TestChatFilesPage() {
  return (
    <Suspense fallback={null}>
      <TestChatFiles />
    </Suspense>
  );
}

async function TestChatFiles() {
  await connection();
  if (!testPagesEnabled()) notFound();
  const shared = messages.filter((m) => m.files.length > 0 || m.body.includes("http")).reverse();
  return (
    <ChatShell groups={groups} group={groups[1]} tab="files" ownCampusName="Lagos">
      <SharedList items={shared} groupName="Lagos" />
    </ChatShell>
  );
}
