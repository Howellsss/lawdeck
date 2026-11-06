import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ChatShell } from "@/components/chat/ChatShell";
import type { ChatMessage, ChatPoll, LessonCard, WeekTopic } from "@/server/chat/data";
import { groups, invites } from "../chatSample";
import { testPagesEnabled } from "../sample";

// Study group conversation test only (tests/voice/chat.spec.ts): a made-up voice note and the
// record button, which only study groups have, a shared lesson card, "This week's topic" and two polls. "Not found" unless LAWDECK_TEST_PAGES=1.
const study = groups.find((g) => g.kind === "study") ?? groups[0];
const card: LessonCard = { topicId: "00000000-0000-4000-8000-000000000871", course: "Civil Litigation", topic: "Originating processes", title: "Originating processes", bulkApproved: true };
const weekTopic: WeekTopic = { card: { ...card, bulkApproved: false }, setBy: "Ada Wombat", setAt: new Date(Date.now() - 60 * 60_000).toISOString() };
const closes = new Date(Date.now() + 26 * 3_600_000).toISOString();
const openPoll: ChatPoll = {
  id: "00000000-0000-4000-8000-000000000881",
  choices: ["Monday", "Tuesday"].map((label) => ({ label, votes: null, voters: null })),
  total: null,
  showNames: false,
  closesAt: closes,
  closed: false,
  mine: true,
  myChoice: null,
};
const votedPoll: ChatPoll = {
  id: "00000000-0000-4000-8000-000000000882",
  choices: [
    { label: "Online", votes: 2, voters: ["Ada Wombat", "Tunde Quokka"] },
    { label: "In person", votes: 1, voters: ["Bisi Numbat"] },
  ],
  total: 3,
  showNames: true,
  closesAt: closes,
  closed: false,
  mine: false,
  myChoice: 0,
};
const messages: ChatMessage[] = [
  {
    id: "00000000-0000-4000-8000-000000000861",
    groupId: study.id,
    body: "Quick summary of Order 3 for tonight",
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    author: { id: "00000000-0000-4000-8000-000000000812", name: "Tunde Quokka", campus: "Abuja" },
    mine: false,
    files: [{ name: "Voice note", kind: "voice", size: 48_000, url: null, seconds: 42 }],
    lesson: null,
    poll: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000862",
    groupId: study.id,
    body: "Read this before Thursday",
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    author: { id: "00000000-0000-4000-8000-000000000812", name: "Tunde Quokka", campus: "Abuja" },
    mine: false,
    files: [],
    lesson: card,
    poll: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000863",
    groupId: study.id,
    body: "Revision class on which day?",
    createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    author: { id: "00000000-0000-4000-8000-000000000811", name: "Ada Wombat", campus: "Lagos" },
    mine: true,
    files: [],
    lesson: null,
    poll: openPoll,
  },
  {
    id: "00000000-0000-4000-8000-000000000864",
    groupId: study.id,
    body: "Meet online or in person?",
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    author: { id: "00000000-0000-4000-8000-000000000812", name: "Tunde Quokka", campus: "Abuja" },
    mine: false,
    files: [],
    lesson: null,
    poll: votedPoll,
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
      <ChatRoom groupId={study.id} groupName={study.name} initial={messages} initialHasOlder={false} voiceNotes apiKey="test" studyGroup canSetWeekTopic initialWeekTopic={weekTopic} />
    </ChatShell>
  );
}
