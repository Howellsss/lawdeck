import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProgressView } from "@/components/progress/ProgressView";
import { courseProgress, studyDays, topicProgress, weakestTopics, weeklyAccuracy, type Attempt, type Point } from "@/lib/progress";
import type { Progress } from "@/server/db/progress";
import { testPagesEnabled } from "../sample";

// My progress test only (tests/voice/progress.spec.ts): made-up topics and answers, to check the
// layout on phones and desktops. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
const now = new Date("2026-11-06T10:00:00Z");
const topics = [
  { id: "00000000-0000-4000-8000-000000000601", name: "Wombat summons", courseSlug: "civil-litigation", courseName: "Civil Litigation" },
  { id: "00000000-0000-4000-8000-000000000602", name: "Quokka bail applications", courseSlug: "criminal-litigation", courseName: "Criminal Litigation" },
  { id: "00000000-0000-4000-8000-000000000603", name: "Numbat appeals", courseSlug: "civil-litigation", courseName: "Civil Litigation" },
];
const point = (topic: number, interval_days: number, last_outcome: Point["last_outcome"], due_at = "2026-11-12T00:00:00Z"): Point => ({
  topic_id: topics[topic].id,
  interval_days,
  ease: last_outcome === "correct" ? 2.6 : 2.1,
  last_outcome,
  due_at,
});
const points = [
  point(0, 16, "correct"),
  point(0, 35, "correct"),
  point(0, 3, "correct"),
  point(0, 1, "incorrect", "2026-11-05T00:00:00Z"),
  point(1, 1, "incorrect", "2026-11-05T00:00:00Z"),
  point(1, 3, "partly"),
  point(1, 7, "correct"),
  point(2, 16, "correct"),
  point(2, 8, "correct"),
];
const attempts: Attempt[] = Array.from({ length: 40 }, (_, i) => ({
  topic_id: topics[i % 3].id,
  outcome: i % 4 === 0 ? "incorrect" : i % 7 === 0 ? "partly" : "correct",
  created_at: new Date(now.getTime() - i * 1.3 * 86_400_000).toISOString(),
}));
const rows = topicProgress(points, attempts, topics, now);
const progress: Progress = {
  courses: courseProgress(rows),
  weakest: weakestTopics(rows),
  weeks: weeklyAccuracy(attempts, now),
  days: studyDays(["2026-11-05", "2026-11-04", "2026-11-03", "2026-10-30", "2026-10-29", "2026-10-20", "2026-10-14"], now),
  totals: {
    points: points.length,
    mastered: rows.reduce((n, r) => n + r.mastered, 0),
    learning: rows.reduce((n, r) => n + r.learning, 0),
    slipping: rows.reduce((n, r) => n + r.slipping, 0),
    answered: attempts.length,
    correct: attempts.filter((a) => a.outcome === "correct").length,
  },
};

export default function TestProgressPage() {
  return (
    <Suspense fallback={null}>
      <TestProgress />
    </Suspense>
  );
}

async function TestProgress() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">My progress</h1>
      <ProgressView progress={progress} />
    </div>
  );
}
