import "server-only";
import { courseProgress, studyDays, topicProgress, weakestTopics, weeklyAccuracy, type CourseProgress, type StudyDays, type TopicProgress, type Week } from "@/lib/progress";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { Loaded } from "./workspace";

// My progress (Remembrance Phase 4b): assembled from the student's own revision points, answers and
// study days, like the Study Diary, so the figures always agree. Row-level security keeps it theirs.
export type Progress = {
  courses: CourseProgress[];
  weakest: TopicProgress[];
  weeks: Week[];
  days: StudyDays;
  totals: { points: number; mastered: number; learning: number; slipping: number; answered: number; correct: number };
};

export async function getProgress(at?: Date): Promise<Loaded<Progress>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  // Read the clock only after the request is known (Next.js would otherwise freeze it at build time).
  const now = at ?? new Date();
  const db = await createSupabaseServerClient();
  const [points, attempts, sessions] = await Promise.all([
    db.from("review_items").select("topic_id, interval_days, ease, last_outcome, due_at").limit(10000),
    db.from("recall_attempts").select("topic_id, outcome, created_at").order("created_at", { ascending: false }).limit(10000),
    db.from("study_sessions").select("topic_id, study_date").order("study_date", { ascending: false }).limit(1000),
  ]);
  if (points.error || attempts.error || sessions.error) throw new Error("progress read failed");
  const topicIds = [...new Set([...points.data.map((p) => p.topic_id), ...attempts.data.map((a) => a.topic_id)])];
  const [topics, courses] = await Promise.all([
    topicIds.length ? db.from("topics").select("id, name, course_id").in("id", topicIds) : Promise.resolve({ data: [] as { id: string; name: string; course_id: string }[], error: null }),
    db.from("courses").select("id, slug, name, position").order("position"),
  ]);
  if (topics.error || courses.error) throw new Error("progress read failed");
  const courseOf = new Map(courses.data.map((c) => [c.id, c]));
  const info = topics.data.map((t) => ({ id: t.id, name: t.name, courseSlug: courseOf.get(t.course_id)?.slug ?? "", courseName: courseOf.get(t.course_id)?.name ?? "" }));
  const rows = topicProgress(points.data, attempts.data, info, now);
  const order = new Map(courses.data.map((c) => [c.slug, c.position]));
  const byCourse = courseProgress(rows).sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
  const sum = (key: "points" | "mastered" | "learning" | "slipping" | "answered" | "correct") => rows.reduce((n, r) => n + r[key], 0);
  return {
    status: "ok",
    data: {
      courses: byCourse,
      weakest: weakestTopics(rows),
      weeks: weeklyAccuracy(attempts.data, now),
      days: studyDays(sessions.data.map((s) => s.study_date), now),
      totals: { points: sum("points"), mastered: sum("mastered"), learning: sum("learning"), slipping: sum("slipping"), answered: sum("answered"), correct: sum("correct") },
    },
  };
}
