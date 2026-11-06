import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatShell } from "@/components/chat/ChatShell";
import { QuizPanel } from "@/components/chat/quiz/QuizPanel";
import type { QuizState } from "@/lib/quiz";
import { groups, invites } from "../chatSample";
import { testPagesEnabled } from "../sample";

// Group quiz test only (tests/voice/chat.spec.ts): a made-up "get ready" (?s=ready), live question
// (?s=live, closed with ?s=closed) or final results (?s=done), to check the layout on phones and desktops. Answering needs
// an account here. "Not found" unless LAWDECK_TEST_PAGES=1.
const study = groups.find((g) => g.kind === "study") ?? groups[0];
const base: QuizState = {
  id: "00000000-0000-4000-8000-000000000901",
  status: "live",
  topic: "Originating processes",
  host: "Ada Wombat",
  isHost: true,
  joined: true,
  players: 3,
  total: 5,
  current: 1,
  seconds: 20,
  readyIn: 0,
  secondsLeft: 12,
  answered: 1,
  question: { prompt: "Which originating process suits a case where the facts are not in dispute?", choices: ["Writ of summons", "Originating summons", "Petition", "Originating motion"] },
  closed: false,
  correctChoice: null,
  explanation: null,
  myChoice: null,
  myCorrect: null,
  myPoints: null,
  counts: null,
  myStreak: 0,
  leaderboard: [
    { name: "Tunde Quokka", points: 1840, correct: 2, streak: 2, me: false },
    { name: "Ada Wombat", points: 920, correct: 1, streak: 1, me: true },
    { name: "Chi Numbat", points: 0, correct: 0, streak: 0, me: false },
  ],
};
const closed: QuizState = { ...base, secondsLeft: 0, closed: true, myChoice: 1, correctChoice: 1, myCorrect: true, myPoints: 960, myStreak: 2, counts: [0, 2, 1, 0], explanation: "Use an originating summons where the facts are not likely to be disputed." };
const states: Record<string, QuizState> = {
  ready: { ...base, readyIn: 2.4, secondsLeft: 20, question: null, answered: 0 },
  live: base,
  closed,
  done: { ...closed, status: "done", question: null },
};
const topics = [
  { id: "00000000-0000-4000-8000-000000000911", course: "Civil Litigation", topic: "Originating processes", questions: 8 },
  { id: "00000000-0000-4000-8000-000000000912", course: "Criminal Litigation", topic: "Bail", questions: 6 },
];

export default function TestChatQuizPage({ searchParams }: PageProps<"/test-pages/chat-quiz">) {
  return (
    <Suspense fallback={null}>
      <TestChatQuiz searchParams={searchParams} />
    </Suspense>
  );
}

async function TestChatQuiz({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (!testPagesEnabled()) notFound();
  const s = (await searchParams).s;
  const initial = typeof s === "string" ? (states[s] ?? null) : null;
  return (
    <ChatShell groups={groups} group={study} tab="quiz" ownCampusName="Lagos" invites={invites}>
      <QuizPanel groupId={study.id} initial={initial} topics={topics} />
    </ChatShell>
  );
}
