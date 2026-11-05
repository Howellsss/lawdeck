"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { BULK_KINDS, bulkCost, type BulkKind } from "@/lib/bulkKinds";

export type MissingTopic = { id: string; name: string; courseId: string; courseName: string };
type State = "waiting" | "writing" | "done" | "failed";

// Writing several at a time is faster, but long Opus replies in parallel can hit the account's
// output-per-minute limit and slow each other past the time limit; two is the safer balance.
const AT_ONCE = 2;

async function post(endpoint: string, topicId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicId }) });
    const result = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;
    return { ok: Boolean(result?.ok), message: result?.message ?? "It could not be written." };
  } catch {
    return { ok: false, message: "The connection was lost. It may still have saved: reload to check." };
  }
}

// Admin → Lessons: write every missing lesson, update every lesson with new library material, or
// write every lesson's missing memory aids, in one go (founder, 2026-11-05). After each lesson its
// memory aids and stories are written too, so one press does both. Each piece is its own request
// (a few minutes each), so the page must stay open; only what is missing is written, so pressing
// again never pays twice.
export function BulkWriteLessons({ topics, courses, kind = "lesson" }: { topics: MissingTopic[]; courses: { id: string; name: string }[]; kind?: BulkKind }) {
  const k = BULK_KINDS[kind];
  const label = (n: number) => `${n} ${n === 1 ? k.one : k.many}`;
  const router = useRouter();
  const [course, setCourse] = useState("all");
  const [withAids, setWithAids] = useState(true);
  const [states, setStates] = useState<Record<string, State>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aidNotes, setAidNotes] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const chosen = topics.filter((t) => course === "all" || t.courseId === course);
  const queue = chosen.filter((t) => states[t.id] !== "done");
  const done = chosen.filter((t) => states[t.id] === "done").length;
  const failed = chosen.filter((t) => states[t.id] === "failed");
  const aidsMissed = chosen.filter((t) => aidNotes[t.id]);
  const cost = bulkCost(kind, queue.length, withAids);

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function writeOne(topic: MissingTopic, aids: boolean) {
    setStates((s) => ({ ...s, [topic.id]: "writing" }));
    const result = await post(k.endpoint, topic.id);
    if (!result.ok) {
      setErrors((e) => ({ ...e, [topic.id]: result.message }));
      setStates((s) => ({ ...s, [topic.id]: "failed" }));
      return;
    }
    if (k.lessons && aids) {
      const extras = await post(BULK_KINDS.extras.endpoint, topic.id);
      if (!extras.ok) setAidNotes((n) => ({ ...n, [topic.id]: extras.message }));
    }
    setStates((s) => ({ ...s, [topic.id]: "done" }));
  }

  async function start(list: MissingTopic[]) {
    const { low, high } = bulkCost(kind, list.length, withAids);
    const keep = kind === "update" ? " Students keep the current approved version of each until you approve its update." : "";
    if (!window.confirm(`${k.verb} ${label(list.length)}? This costs about US$${low}–${high} and takes a while. Keep this page open until it finishes.${keep}`)) return;
    stop.current = false;
    setRunning(true);
    setErrors({});
    setAidNotes({});
    const pending = [...list];
    const aids = withAids;
    async function worker() {
      while (!stop.current) {
        const next = pending.shift();
        if (!next) return;
        await writeOne(next, aids);
      }
    }
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, list.length) }, worker));
    setRunning(false);
    router.refresh();
  }

  if (topics.length === 0) return <p className="text-sm text-success">{k.none}</p>;

  return (
    <section aria-labelledby={`bulk-write-${kind}`} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id={`bulk-write-${kind}`} className="text-base font-medium">
        {k.title}
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Which course
          <select value={course} onChange={(e) => setCourse(e.target.value)} disabled={running} className="h-10 rounded-lg border border-line bg-paper px-3 text-[15px]">
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
            {k.verb} {label(queue.length)}
          </button>
        )}
      </div>
      {k.lessons && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withAids} disabled={running} onChange={(e) => setWithAids(e.target.checked)} className="size-4" />
          Also write each lesson&rsquo;s memory aids and stories
        </label>
      )}
      <p className="text-sm text-muted">
        About US${cost.low}–{cost.high} · {AT_ONCE} at a time, a few minutes each. Each one still waits for approval before students see it.
      </p>
      {(running || done > 0 || failed.length > 0) && (
        <p role="status" className="text-sm">
          {running ? "Writing… keep this page open. " : ""}
          <span className="text-success">{done}</span> of {chosen.length} written
          {failed.length > 0 ? ` · ${failed.length} not written` : ""}
        </p>
      )}
      {!running && aidsMissed.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <p>Written, but their memory aids were not (use &ldquo;Write memory aids and stories&rdquo; later):</p>
          <ul className="flex flex-col gap-1">
            {aidsMissed.map((t) => (
              <li key={t.id}>
                {t.name}: <span className="text-muted">{aidNotes[t.id]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!running && failed.length > 0 && (
        <div className="flex flex-col gap-2">
          <FormAlert tone="warning" message={`${label(failed.length)} not written. You can try ${failed.length === 1 ? "it" : "them"} again.`} />
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
