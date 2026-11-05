import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DiaryFilters } from "@/components/diary/DiaryFilters";
import { DiaryStats } from "@/components/diary/DiaryStats";
import { DiaryTimeline } from "@/components/diary/DiaryTimeline";
import type { DiaryEntrySummary } from "@/server/db/diary";
import { testPagesEnabled } from "../sample";

// Diary test only (tests/voice/diary.spec.ts): made-up entries, to check the layout on phones and
// desktops. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
const entry = (n: number, date: string, status: "due" | "upcoming" | "none"): DiaryEntrySummary => ({
  sessionId: `00000000-0000-4000-8000-00000000040${n}`,
  date,
  startedAt: `${date}T09:00:00Z`,
  topicId: `00000000-0000-4000-8000-00000000050${n}`,
  topicName: ["Wombat summons", "Quokka pleadings", "Numbat appeals"][n % 3],
  courseSlug: "civil-litigation",
  courseName: "Civil Litigation",
  minutes: 20 + n * 7,
  completed: n % 2 === 0,
  answered: 8,
  correct: 5 + (n % 3),
  revision: { status, dueAt: status === "upcoming" ? `${date}T09:00:00Z` : null },
  authorities: ["Wombat v Quokka"],
});

export default function TestDiaryPage() {
  return (
    <Suspense fallback={null}>
      <TestDiary />
    </Suspense>
  );
}

async function TestDiary() {
  await connection();
  if (!testPagesEnabled()) notFound();
  const entries = [entry(1, "2026-11-05", "due"), entry(2, "2026-11-05", "upcoming"), entry(3, "2026-11-04", "none")];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Study Diary</h1>
      <DiaryStats totals={{ topics: 3, completed: 1, minutes: 104, answered: 24, correct: 17, dueNow: 4 }} />
      <DiaryFilters filter={{}} courses={[{ slug: "civil-litigation", name: "Civil Litigation" }]} topics={entries.map((e) => ({ id: e.topicId, name: e.topicName }))} />
      <DiaryTimeline entries={entries} />
    </div>
  );
}
