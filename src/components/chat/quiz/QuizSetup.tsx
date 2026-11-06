"use client";

import { useId, useState } from "react";
import { primaryButton } from "@/components/ui/buttons";
import type { QuizTopic } from "@/server/chat/quiz";

// Hosting a quiz: a topic (only topics whose reviewed lesson has enough questions), how many
// questions and how long for each.
export function QuizSetup({ topics, busy, onStart }: { topics: QuizTopic[]; busy: boolean; onStart: (topicId: string, count: number, seconds: number) => void }) {
  const id = useId();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [seconds, setSeconds] = useState(20);
  const courses = [...new Set(topics.map((t) => t.course))];
  if (topics.length === 0)
    return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">No topics have enough reviewed questions for a quiz yet.</p>;
  const chosen = topics.find((t) => t.id === topic);
  return (
    <form
      onSubmit={(e) => (e.preventDefault(), topic && onStart(topic, Math.min(count, chosen?.questions ?? count), seconds))}
      className="flex max-w-xl flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
      aria-labelledby={`${id}-h`}
    >
      <div>
        <h2 id={`${id}-h`} className="text-lg font-medium">
          Host a quiz
        </h2>
        <p className="text-[14px] text-muted">Questions come from Lawdeck&rsquo;s reviewed lessons. Faster right answers score more points.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        Topic
        <select value={topic} onChange={(e) => setTopic(e.target.value)} required className="h-11 rounded-lg border border-line bg-paper px-2 text-[16px] font-normal">
          <option value="">Choose a topic</option>
          {courses.map((c) => (
            <optgroup key={c} label={c}>
              {topics
                .filter((t) => t.course === c)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic} ({t.questions} questions)
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Questions
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-11 rounded-lg border border-line bg-paper px-2 text-[16px] font-normal">
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Time per question
          <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="h-11 rounded-lg border border-line bg-paper px-2 text-[16px] font-normal">
            {[10, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <button type="submit" disabled={!topic || busy} className={primaryButton}>
          {busy ? "Starting…" : "Create quiz"}
        </button>
      </div>
    </form>
  );
}
