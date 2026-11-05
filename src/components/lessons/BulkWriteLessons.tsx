"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";

export type MissingTopic = { id: string; name: string; courseId: string; courseName: string };
type State = "waiting" | "writing" | "done" | "failed";

// Writing several lessons at a time is faster, but more risks the AI provider's rate limit.
const AT_ONCE = 3;
// Per lesson, from the AI cost model (docs/specs/remembrance.md): Opus with up to 40 passages.
const COST_LOW = 0.2;
const COST_HIGH = 0.5;

// Admin → Lessons: write every missing lesson in one go (founder, 2026-11-05). Each lesson is still
// its own request (a few minutes each), so the page must stay open; it only writes topics with no
// lesson yet, so pressing it again never pays twice.
export function BulkWriteLessons({ topics, courses }: { topics: MissingTopic[]; courses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [course, setCourse] = useState("all");
  const [states, setStates] = useState<Record<string, State>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const chosen = topics.filter((t) => course === "all" || t.courseId === course);
  const queue = chosen.filter((t) => states[t.id] !== "done");
  const done = chosen.filter((t) => states[t.id] === "done").length;
  const failed = chosen.filter((t) => states[t.id] === "failed");

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function writeOne(topic: MissingTopic) {
    setStates((s) => ({ ...s, [topic.id]: "writing" }));
    try {
      const response = await fetch("/api/admin/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: topic.id }),
      });
      const result = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;
      if (result?.ok) {
        setStates((s) => ({ ...s, [topic.id]: "done" }));
        return;
      }
      setErrors((e) => ({ ...e, [topic.id]: result?.message ?? "It could not be written." }));
    } catch {
      setErrors((e) => ({ ...e, [topic.id]: "The connection was lost. It may still have saved: reload to check." }));
    }
    setStates((s) => ({ ...s, [topic.id]: "failed" }));
  }

  async function start(list: MissingTopic[]) {
    const low = (list.length * COST_LOW).toFixed(2);
    const high = (list.length * COST_HIGH).toFixed(2);
    if (!window.confirm(`Write ${list.length} lesson${list.length === 1 ? "" : "s"}? This costs about US$${low}–${high} and takes a while. Keep this page open until it finishes.`)) return;
    stop.current = false;
    setRunning(true);
    setErrors({});
    const pending = [...list];
    async function worker() {
      while (!stop.current) {
        const next = pending.shift();
        if (!next) return;
        await writeOne(next);
      }
    }
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, list.length) }, worker));
    setRunning(false);
    router.refresh();
  }

  if (topics.length === 0)
    return <p className="text-sm text-success">Every topic has a lesson.</p>;

  return (
    <section aria-labelledby="bulk-write" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id="bulk-write" className="text-base font-medium">
        Write all missing lessons
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Which course
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            disabled={running}
            className="h-10 rounded-lg border border-line bg-paper px-3 text-[15px]"
          >
            <option value="all">All courses ({topics.length})</option>
            {courses.map((c) => {
              const count = topics.filter((t) => t.courseId === c.id).length;
              return count ? (
                <option key={c.id} value={c.id}>
                  {c.name} ({count})
                </option>
              ) : null;
            })}
          </select>
        </label>
        {running ? (
          <button type="button" className={compactSecondaryButton} onClick={() => (stop.current = true)}>
            Stop after the ones being written
          </button>
        ) : (
          <button type="button" className={compactPrimaryButton} disabled={queue.length === 0} onClick={() => void start(queue)}>
            Write {queue.length} lesson{queue.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        About US${(queue.length * COST_LOW).toFixed(2)}–{(queue.length * COST_HIGH).toFixed(2)} · {AT_ONCE} at a time, a few minutes each. Every
        lesson still waits for approval before students see it.
      </p>
      {(running || done > 0 || failed.length > 0) && (
        <p role="status" className="text-sm">
          {running ? "Writing… keep this page open. " : ""}
          <span className="text-success">{done}</span> of {chosen.length} written
          {failed.length > 0 ? ` · ${failed.length} not written` : ""}
        </p>
      )}
      {!running && failed.length > 0 && (
        <div className="flex flex-col gap-2">
          <FormAlert tone="warning" message={`${failed.length} lesson${failed.length === 1 ? " was" : "s were"} not written. You can try them again.`} />
          <ul className="flex flex-col gap-1 text-sm">
            {failed.map((t) => (
              <li key={t.id}>
                {t.name}: <span className="text-muted">{errors[t.id]}</span>
              </li>
            ))}
          </ul>
          <button type="button" className={`${compactSecondaryButton} self-start`} onClick={() => void start(failed)}>
            Try the {failed.length} again
          </button>
        </div>
      )}
    </section>
  );
}
