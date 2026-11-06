import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RevisionRound } from "@/components/study/RevisionRound";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { z } from "@/lib/zod";
import { DAILY_REVISION_CAP } from "@/lib/revision";
import { getDueRevision, whenStudied } from "@/server/db/revision";

export const metadata: Metadata = { title: "Memory challenge · Lawdeck" };

// "Before you move on" (docs/specs/remembrance.md, Phase 1d): the questions due for revision.
const topicParam = z.uuid();

export default function RevisePage({ searchParams }: PageProps<"/revise">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading your revision" />}>
        <Revise searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Revise({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // "Revise now" on My progress opens one topic's due questions; anything else means all topics.
  const asked = topicParam.safeParse((await searchParams).topic);
  const topicId = asked.success ? asked.data : undefined;
  const result = await getDueRevision(undefined, topicId);
  if (result.status === "signed-out")
    return <SignInPrompt what="revision" returnTo="/revise" />;
  const { questions, lastStudied, dailyCapReached, totalDue } = result.data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">
          Before you move on…
        </p>
        <h1 className="font-serif text-3xl font-normal text-greeting">
          {topicId && questions[0]
            ? `Revising ${questions[0].topicName}`
            : lastStudied
              ? `${whenStudied(lastStudied.date)}, you studied ${lastStudied.topicName}.`
              : "Memory challenge"}
        </h1>
        {questions.length > 0 && (
          <p className="text-muted">
            Let&rsquo;s see what you still remember. Answer from memory; the
            answer shows after you try. The points you found hardest come first.
          </p>
        )}
      </div>
      {questions.length === 0 && dailyCapReached ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          That&rsquo;s today&rsquo;s {DAILY_REVISION_CAP} revision questions
          done. The other {totalDue} come back tomorrow, weakest first, so a
          long break never turns into a pile.{" "}
          <Link href="/courses">Study something new</Link>
        </p>
      ) : questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          Nothing is due for revision right now. Points you study come back here
          at the right time. <Link href="/courses">Study a topic</Link>
        </p>
      ) : (
        <RevisionRound questions={questions} />
      )}
    </>
  );
}
