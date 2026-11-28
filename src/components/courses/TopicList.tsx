"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { openNewChat } from "@/components/learn/openNewChat";
import type { TopicSummary } from "@/server/db/workspace";

// A course's topics. "Study" opens the topic's approved lesson (docs/specs/remembrance.md); "Explain" starts a Learn chat in that course ("Explain <topic>"); "MCQ"
// opens multiple-choice questions on the topic (founder, 2026-10-30: was "Practise"). Both
// show at once that they are working.
export function TopicList({ courseSlug, topics }: { courseSlug: string; topics: TopicSummary[] }) {
  const router = useRouter();
  // Which button is working: "explain:<topic id>" or "mcq:<topic id>".
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  // Search box above the list (founder, 2026-11-28): filters as the student types; numbers stay
  // the course's teaching order.
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = topics
    .map((topic, index) => ({ topic, number: index + 1 }))
    .filter(({ topic }) => words.every((word) => topic.name.toLowerCase().includes(word)));

  if (topics.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
        No topics have been added to this course yet. You can still ask about it from the home screen.
      </p>
    );
  }

  async function explain(topic: TopicSummary) {
    setBusy(`explain:${topic.id}`);
    setMessage(undefined);
    const problem = await openNewChat(router, { question: `Explain ${topic.name}`, course: courseSlug, mode: "learn" });
    if (problem) {
      setBusy(null);
      setMessage(problem.message);
    }
  }

  return (
    <section aria-labelledby="topics" className="flex flex-col gap-3">
      <h2 id="topics" className="text-lg font-medium">
        Topics ({topics.length})
      </h2>
      <label>
        <span className="sr-only">Search topics</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search topics"
          className="h-11 w-full rounded-full border border-line bg-surface px-4 text-[15px] placeholder:text-muted"
        />
      </label>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      {shown.length === 0 ? (
        <p role="status" className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">
          No topic matches “{query.trim()}”. Try another word, or ask about it from the home screen.
        </p>
      ) : (
      <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        {shown.map(({ topic, number }) => (
          <li key={topic.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="min-w-0 break-words text-[15px]">
              <span className="mr-2 text-muted">{number}.</span>
              {topic.name}
            </span>
            {/* One row of buttons: below the name on phones, beside it on wider screens. */}
            <span className="flex shrink-0 flex-nowrap gap-1.5 sm:justify-end sm:gap-2">
              {topic.hasLesson && (
                <Link href={`/study/${topic.id}`} className={`${topicButton} border-ink bg-ink text-on-ink no-underline hover:bg-ink`}>
                  Study
                  <span className="sr-only"> {topic.name}</span>
                </Link>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void explain(topic)}
                className={topicButton}
              >
                {busy === `explain:${topic.id}` ? <Working>Opening…</Working> : "Explain"}
                <span className="sr-only"> {topic.name}</span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setBusy(`mcq:${topic.id}`);
                  router.push(`/practice/new?topic=${topic.id}`);
                }}
                className={topicButton}
              >
                {busy === `mcq:${topic.id}` ? <Working>Opening…</Working> : "MCQ"}
                <span className="sr-only"> on {topic.name}</span>
              </button>
            </span>
          </li>
        ))}
      </ol>
      )}
    </section>
  );
}

// Slightly smaller on phones so Study, Explain and MCQ always fit on one line (founder, 2026-11-28).
const topicButton =
  "inline-flex items-center whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-pill disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm";

function Working({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-2">
      <Spinner size={14} />
      {children}
    </span>
  );
}
