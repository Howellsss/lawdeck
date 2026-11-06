import type { RecallOutcome } from "./revision";
import { lagosDate } from "./studyDates";

// My progress (Remembrance Phase 4b; docs/specs/remembrance.md): how well each topic is remembered,
// worked out from the student's own revision points and recorded answers only. It describes what
// the answers show; it never predicts exam results.

export type PointState = "mastered" | "learning" | "slipping";
export type Point = { topic_id: string; interval_days: number; ease: number | null; last_outcome: RecallOutcome | null; due_at: string };
export type Attempt = { topic_id: string; outcome: RecallOutcome; created_at: string };
export type TopicInfo = { id: string; name: string; courseSlug: string; courseName: string };

// Mastered: remembered last time and now spaced two weeks or more apart. Slipping: missed or only
// partly remembered last time, or a point the student has found hard (low ease). Otherwise learning.
export const MASTERED_GAP_DAYS = 14;
export const SLIPPING_EASE = 2.2;
export function pointState(p: Point): PointState {
  if (p.last_outcome === "incorrect" || p.last_outcome === "skipped" || p.last_outcome === "partly") return "slipping";
  if ((p.ease ?? 2.5) < SLIPPING_EASE) return "slipping";
  if (p.last_outcome === "correct" && p.interval_days >= MASTERED_GAP_DAYS) return "mastered";
  return "learning";
}

export type Tally = { points: number; mastered: number; learning: number; slipping: number; dueNow: number; answered: number; correct: number };
export type TopicProgress = TopicInfo & Tally & { accuracy: number | null };
export type CourseProgress = { slug: string; name: string } & Tally & { accuracy: number | null; topics: TopicProgress[] };

const emptyTally = (): Tally => ({ points: 0, mastered: 0, learning: 0, slipping: 0, dueNow: 0, answered: 0, correct: 0 });
export const accuracyOf = (t: { answered: number; correct: number }) => (t.answered ? Math.round((t.correct / t.answered) * 100) : null);

export function topicProgress(points: Point[], attempts: Attempt[], topics: TopicInfo[], now: Date): TopicProgress[] {
  const tallies = new Map<string, Tally>();
  const tally = (id: string) => tallies.get(id) ?? tallies.set(id, emptyTally()).get(id)!;
  for (const p of points) {
    const t = tally(p.topic_id);
    t.points++;
    t[pointState(p)]++;
    if (new Date(p.due_at).getTime() <= now.getTime()) t.dueNow++;
  }
  for (const a of attempts) {
    const t = tally(a.topic_id);
    t.answered++;
    if (a.outcome === "correct") t.correct++;
  }
  return topics
    .filter((topic) => tallies.has(topic.id))
    .map((topic) => {
      const t = tallies.get(topic.id)!;
      return { ...topic, ...t, accuracy: accuracyOf(t) };
    });
}

export function courseProgress(topics: TopicProgress[]): CourseProgress[] {
  const courses = new Map<string, CourseProgress>();
  for (const topic of topics) {
    const c = courses.get(topic.courseSlug) ?? { slug: topic.courseSlug, name: topic.courseName, ...emptyTally(), accuracy: null, topics: [] };
    for (const key of ["points", "mastered", "learning", "slipping", "dueNow", "answered", "correct"] as const) c[key] += topic[key];
    c.topics.push(topic);
    courses.set(topic.courseSlug, c);
  }
  return [...courses.values()].map((c) => ({ ...c, accuracy: accuracyOf(c), topics: [...c.topics].sort((a, b) => a.name.localeCompare(b.name)) }));
}

// The topics most worth revising: those with slipping points, the largest share slipping first,
// then the lowest accuracy.
export function weakestTopics(topics: TopicProgress[], count = 5): TopicProgress[] {
  return topics
    .filter((t) => t.slipping > 0)
    .sort((a, b) => b.slipping / b.points - a.slipping / a.points || (a.accuracy ?? 0) - (b.accuracy ?? 0) || a.name.localeCompare(b.name))
    .slice(0, count);
}

// Recall accuracy by week (Monday to Sunday, Lagos), oldest first, for the last `weeks` weeks.
export type Week = { start: string; answered: number; correct: number; accuracy: number | null };
export function weeklyAccuracy(attempts: Attempt[], now: Date, weeks = 8): Week[] {
  const monday = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const thisWeek = monday(lagosDate(now));
  const starts = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(`${thisWeek}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const byWeek = new Map(starts.map((s) => [s, { answered: 0, correct: 0 }]));
  for (const a of attempts) {
    const w = byWeek.get(monday(lagosDate(new Date(a.created_at))));
    if (!w) continue;
    w.answered++;
    if (a.outcome === "correct") w.correct++;
  }
  return starts.map((start) => {
    const w = byWeek.get(start)!;
    return { start, ...w, accuracy: accuracyOf(w) };
  });
}

// Study days: the last `days` Lagos days (oldest first) marked studied or not, how many were
// studied, and the current run of days in a row (today counts if studied, else it starts yesterday).
export type StudyDays = { days: { date: string; studied: boolean }[]; studiedCount: number; streak: number };
export function studyDays(dates: string[], now: Date, days = 35): StudyDays {
  const studied = new Set(dates);
  const today = lagosDate(now);
  const list = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const date = d.toISOString().slice(0, 10);
    return { date, studied: studied.has(date) };
  });
  let streak = 0;
  let i = list.length - 1;
  if (!list[i]?.studied) i--;
  for (; i >= 0 && list[i].studied; i--) streak++;
  return { days: list, studiedCount: list.filter((d) => d.studied).length, streak };
}
