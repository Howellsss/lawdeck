import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatGate } from "@/components/chat/ChatGate";
import { ChatShell } from "@/components/chat/ChatShell";
import { QuizPanel } from "@/components/chat/quiz/QuizPanel";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { chatAllowed, getChatMembers } from "@/server/chat/data";
import { getLatestQuiz, quizTopics } from "@/server/chat/quiz";
import { getOwnCampus } from "@/server/db/campuses";

export const metadata: Metadata = { title: "Quiz · Campus chat · Lawdeck" };

const keySchema = z.string().regex(/^[a-z][a-z-]{1,39}$/);

// A study group's Quiz tab (docs/specs/chat.md): host or join a live quiz.
export default function ChatQuizPage({ params }: PageProps<"/chat/[group]/quiz">) {
  return (
    <Suspense fallback={<LoadingRows label="Loading the quiz" />}>
      <Quiz params={params} />
    </Suspense>
  );
}

async function Quiz({ params }: { params: Promise<{ group: string }> }) {
  const key = keySchema.safeParse((await params).group);
  if (!key.success) notFound();
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="campus chat" returnTo={`/chat/${key.data}/quiz`} />;
  if (!(await chatAllowed())) return <ChatGate />;
  const [page, campus] = await Promise.all([getChatMembers(key.data), getOwnCampus()]);
  if (!page) notFound();
  const [latest, topics] = await Promise.all([getLatestQuiz({ groupId: page.group.id }), quizTopics()]);
  const campusName = page.groups.find((g) => g.key === campus)?.name ?? null;
  return (
    <ChatShell groups={page.groups} group={page.group} tab="quiz" ownCampusName={campusName} invites={page.invites}>
      <QuizPanel key={latest?.id ?? "none"} groupId={page.group.id} initial={latest} topics={topics} />
    </ChatShell>
  );
}
