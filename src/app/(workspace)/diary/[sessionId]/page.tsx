import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DiaryNote } from "@/components/diary/DiaryNote";
import { SavedAids } from "@/components/study/SavedAids";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { z } from "@/lib/zod";
import { getDiaryEntry } from "@/server/db/diary";

export const metadata: Metadata = { title: "Diary entry · Lawdeck" };

const OUTCOME = { correct: "Recalled", partly: "Partly", incorrect: "Missed", skipped: "Skipped" } as const;
const CONTEXT: Record<string, string> = { reading: "while reading", test: "topic test", revision: "revision" };

// One diary entry (founder's brief, 20 A–F): what I studied, important authorities, my
// remembrance tools, my recall performance, what I need to revisit, and my notes.
export default function DiaryEntryPage({ params }: PageProps<"/diary/[sessionId]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the entry" />}>
        <Entry params={params} />
      </Suspense>
    </div>
  );
}

async function Entry({ params }: { params: Promise<{ sessionId: string }> }) {
  const id = z.uuid().safeParse((await params).sessionId);
  if (!id.success) notFound();
  const result = await getDiaryEntry(id.data);
  if (result.status === "signed-out") return <SignInPrompt what="study diary" returnTo={`/diary/${id.data}`} />;
  if (!result.data) notFound();
  const { summary, subtopics, keyPoints, authorities, attempts, revisit, upcomingReviews, note, savedAids } = result.data;
  const correct = attempts.filter((a) => a.outcome === "correct").length;
  const count = (o: keyof typeof OUTCOME) => attempts.filter((a) => a.outcome === o).length;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/diary" className="text-sm text-muted">
          ← Study Diary
        </Link>
        <h1 className="font-serif text-3xl font-normal text-greeting">{summary.topicName}</h1>
        <p className="text-sm text-muted">
          {summary.courseName} · {formatWat(summary.startedAt)} · {summary.minutes} min{summary.completed ? " · completed" : ""}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`/study/${summary.topicId}`} className="text-sm">
            Study this topic again
          </Link>
          <Link href={`/study/${summary.topicId}/visual`} className="text-sm">
            Revise visually
          </Link>
        </div>
      </div>

      <Section title="What I studied">
        {subtopics.length > 0 ? <List items={subtopics} /> : <Muted>The lesson&rsquo;s sections are no longer available.</Muted>}
        {keyPoints.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-medium">Important concepts</h3>
            <List items={keyPoints} />
          </>
        )}
      </Section>

      <Section title="Important legal authorities">
        {authorities.length === 0 ? (
          <Muted>This lesson names no case or statute.</Muted>
        ) : (
          <ul className="flex flex-col gap-2">
            {authorities.map((a) => (
              <li key={a.key} className="flex flex-col gap-0.5 rounded-xl border border-line px-3 py-2 text-sm">
                <span className="font-medium">
                  {a.kind === "case" ? <i>{a.name}</i> : a.name}
                  {a.citation ? ` ${a.citation}` : ""}
                </span>
                <span>{a.principle}</span>
                {a.source && <span className="text-muted">From the library: {a.source}</span>}
              </li>
            ))}
          </ul>
        )}
        <Muted>Open the lesson to see each authority&rsquo;s full card.</Muted>
      </Section>

      <Section title="My remembrance tools">
        {savedAids.length === 0 ? (
          <Muted>No memory aids saved for this topic yet. Press &ldquo;Save&rdquo; on an aid while you study it to keep it here.</Muted>
        ) : (
          <SavedAids aids={savedAids} open />
        )}
      </Section>

      <Section title="My recall performance">
        {attempts.length === 0 ? (
          <Muted>No questions answered in this session.</Muted>
        ) : (
          <>
            <p className="text-sm">
              {attempts.length} attempted · <span className="text-success">{correct} recalled</span> · {count("partly")} partly ·{" "}
              <span className={count("incorrect") ? "text-warning" : ""}>{count("incorrect")} missed</span> · {count("skipped")} skipped
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {attempts.map((a, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-line pt-1.5">
                  <span className="min-w-0">{a.prompt}</span>
                  <span className={a.outcome === "correct" ? "text-success" : a.outcome === "partly" ? "text-muted" : "text-warning"}>
                    {OUTCOME[a.outcome]} · {CONTEXT[a.context] ?? a.context}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="What I need to revisit">
        {revisit.length === 0 ? <Muted>Nothing missed in this session.</Muted> : <List items={revisit} />}
        {upcomingReviews.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-medium">Revision schedule for this topic</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {upcomingReviews.map((r, i) => (
                <li key={i}>
                  {r.keyPoint} <span className="text-muted">· {formatWat(r.dueAt)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="My notes">
        <DiaryNote topicId={summary.topicId} initial={note} />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 text-[15px] leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
