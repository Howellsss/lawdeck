"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { RUBRIC_MAX_MARKS, RUBRIC_MAX_POINTS, totalMarks } from "@/schemas/rubrics";
import type { CourseTopics, RubricView } from "@/server/db/rubrics";
import { saveRubric } from "@/server/rubrics/actions";
import { RubricPoints, type PointRow } from "./RubricPoints";

const field = "rounded-lg border border-line bg-paper px-3";

// Write or edit a marking guide: the exam-style question and its marking points (step 4d).
export function RubricForm({ courses, rubric }: { courses: CourseTopics; rubric?: RubricView }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(rubric?.courseId ?? courses[0]?.id ?? "");
  const [topicId, setTopicId] = useState(rubric?.topicId ?? "");
  const [title, setTitle] = useState(rubric?.title ?? "");
  const [question, setQuestion] = useState(rubric?.question ?? "");
  const [points, setPoints] = useState<PointRow[]>(rubric?.criteria.length ? rubric.criteria : [{ point: "", marks: 1 }]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "warning"; text: string }>();
  const topics = courses.find((course) => course.id === courseId)?.topics ?? [];

  async function save() {
    setBusy(true);
    setMessage(undefined);
    const result = await saveRubric({ id: rubric?.id, courseId, topicId, title, question, criteria: points });
    setBusy(false);
    if (!result.ok) return setMessage({ tone: "warning", text: result.message });
    if (!rubric) return router.push(`/admin/rubrics/${result.id}`);
    setMessage({ tone: "success", text: "Saved." });
    router.refresh();
  }

  return (
    <form action={save} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-medium">Course</span>
          <select
            value={courseId}
            disabled={Boolean(rubric)}
            onChange={(e) => {
              setCourseId(e.target.value);
              setTopicId("");
            }}
            className={`h-11 ${field}`}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-medium">Topic</span>
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className={`h-11 ${field}`}>
            <option value="">No particular topic</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="font-medium">Short title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required className={`h-11 ${field}`} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-medium">Exam-style question</span>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={6} maxLength={6000} required className={`py-2 ${field}`} />
      </label>
      <RubricPoints points={points} onChange={setPoints} />
      <p className="text-sm text-muted">
        Total: <strong className="text-ink">{totalMarks(points)}</strong> marks · up to {RUBRIC_MAX_POINTS} points, 1–{RUBRIC_MAX_MARKS} marks each
      </p>
      {rubric?.status === "approved" && (
        <p className="text-sm text-warning">This guide is approved. Saving changes puts it back to Draft until it is approved again.</p>
      )}
      {message && (
        <p role={message.tone === "warning" ? "alert" : "status"} className={`text-sm ${message.tone === "warning" ? "text-warning" : "text-success"}`}>
          {message.text}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? "Saving…" : rubric ? "Save changes" : "Save as draft"}
        </button>
        <button type="button" onClick={() => router.push("/admin/rubrics")} className={compactSecondaryButton}>
          Back to all guides
        </button>
      </div>
    </form>
  );
}
