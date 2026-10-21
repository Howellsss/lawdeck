"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { openNewChat } from "@/components/learn/openNewChat";
import type { TopicSummary } from "@/server/db/workspace";

// A course's topics. Choosing one starts a Learn chat in that course: "Explain <topic>".
export function TopicList({ courseSlug, topics }: { courseSlug: string; topics: TopicSummary[] }) {
  const router = useRouter();
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
    setBusy(topic.id);
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
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void explain(topic)}
              className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-pill disabled:opacity-60"
            >
              {busy === topic.id ? "Opening…" : "Explain"}
              <span className="sr-only"> {topic.name}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
