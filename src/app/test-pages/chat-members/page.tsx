import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatShell } from "@/components/chat/ChatShell";
import { MembersPanel } from "@/components/chat/MembersPanel";
import type { GroupPerson } from "@/server/chat/data";
import { groups, invites } from "../chatSample";
import { testPagesEnabled } from "../sample";

// Study group Members tab test only (tests/voice/chat.spec.ts): made-up people, to check the layout
// on phones and desktops. Changes need an account here. "Not found" unless LAWDECK_TEST_PAGES=1.
const people: GroupPerson[] = [
  { id: "00000000-0000-4000-8000-000000000811", name: "Ada Wombat", campus: "Lagos", status: "member", isOwner: true },
  { id: "00000000-0000-4000-8000-000000000812", name: "Tunde Quokka", campus: "Abuja", status: "member", isOwner: false },
  { id: "00000000-0000-4000-8000-000000000813", name: "Chi Numbat", campus: "Enugu", status: "invited", isOwner: false },
];

export default function TestChatMembersPage() {
  return (
    <Suspense fallback={null}>
      <TestChatMembers />
    </Suspense>
  );
}

async function TestChatMembers() {
  await connection();
  if (!testPagesEnabled()) notFound();
  const study = groups.find((g) => g.kind === "study") ?? groups[0];
  return (
    <ChatShell groups={groups} group={study} tab="members" ownCampusName="Lagos" invites={invites}>
      <MembersPanel group={study} people={people} me={people[0].id} />
    </ChatShell>
  );
}
