"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { openNewChat } from "@/components/learn/openNewChat";
import type { TopicSummary } from "@/server/db/workspace";

// A course's topics. "Explain" starts a Learn chat in that course ("Explain <topic>"); "MCQ"
// opens multiple-choice questions on the topic (founder, 2026-10-30: was "Practise"). Both
// show at once that they are working.
export function TopicList({ courseSlug, topics }: { courseSlug: string; topics: TopicSummary[] }) {
  const router = useRouter();
  // Which button is working: "explain:<topic id>" or "mcq:<topic id>".
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();

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
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        {topics.map((topic, index) => (
          <li key={topic.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 break-words text-[15px]">
              <span className="mr-2 text-muted">{index + 1}.</span>
              {topic.name}
            </span>
            <span className="flex shrink-0 flex-wrap justify-end gap-2">
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
    </section>
  );
}

const topicButton =
  "inline-flex items-center rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-pill disabled:opacity-60";

function Working({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-2">
      <Spinner size={14} />
      {children}
    </span>
  );
}
