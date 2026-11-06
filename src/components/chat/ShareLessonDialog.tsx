"use client";

import { useEffect, useId, useRef, useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/Icon";
import { lessonTopics, type LessonTopic } from "@/server/chat/together";

// Picking a lesson to share (a course, then a topic, and an optional note), or this week's topic in
// a study group (no note). Only topics with a reviewed lesson are listed.
export function ShareLessonDialog({
  mode,
  busy,
  error,
  onPick,
  onClose,
}: {
  mode: "share" | "week";
  busy: boolean;
  error?: string;
  onPick: (topicId: string, note: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [topics, setTopics] = useState<LessonTopic[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    void lessonTopics().then((r) => (r.ok ? setTopics(r.topics) : setLoadError(r.message)));
  }, []);

  const courses = [...new Set((topics ?? []).map((t) => t.course))];
  const inCourse = (topics ?? []).filter((t) => t.course === course);
  const title = mode === "week" ? "This week’s topic" : "Share a lesson";

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-32px))] rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={(e) => (e.preventDefault(), topic && onPick(topic, note.trim()))} className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {title}
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink">
            <Icon name="close" size={18} />
          </button>
        </div>
        <p className="text-[14px] text-muted">
          {mode === "week"
            ? "Everyone in the group sees it at the top, and a lesson card is posted in the chat."
            : "A card with the topic and an Open lesson button appears in the chat. Only reviewed lessons can be shared."}
        </p>
        {loadError ? (
          <p role="alert" className="text-[14px] text-warning">
            {loadError}
          </p>
        ) : !topics ? (
          <p role="status" className="text-[14px] text-muted">
            Loading topics…
          </p>
        ) : topics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">No reviewed lessons can be shared yet.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-[15px] font-medium">
              Course
              <select value={course} onChange={(e) => (setCourse(e.target.value), setTopic(""))} className="h-11 rounded-lg border border-line bg-surface px-2 text-[16px] font-normal">
                <option value="">Choose a course</option>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[15px] font-medium">
              Topic
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={!course}
                required
                className="h-11 rounded-lg border border-line bg-surface px-2 text-[16px] font-normal disabled:opacity-60"
              >
                <option value="">{course ? "Choose a topic" : "Choose a course first"}</option>
                {inCourse.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </select>
            </label>
            {mode === "share" && (
              <label className="flex flex-col gap-1.5 text-[15px] font-medium">
                Note (optional)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Why this lesson?"
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-[16px] font-normal"
                />
              </label>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-[14px] text-warning">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className={compactSecondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={!topic || busy} className={compactPrimaryButton}>
            {busy ? "Sharing…" : mode === "week" ? "Set topic" : "Share"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
