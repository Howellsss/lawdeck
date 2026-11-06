import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DiaryFilters } from "@/components/diary/DiaryFilters";
import { DiaryStats } from "@/components/diary/DiaryStats";
import { DiaryTimeline } from "@/components/diary/DiaryTimeline";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { filterDiary, readDiaryFilter } from "@/lib/diaryFilter";
import { getDiaryOverview } from "@/server/db/diary";

export const metadata: Metadata = { title: "Study Diary · Lawdeck" };

// The Study Diary (docs/specs/remembrance.md, Phase 1c): what the student studied, how they
// recalled it and what to revisit, assembled from their own study records.
export default function DiaryPage({ searchParams }: PageProps<"/diary">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">Study Diary</h1>
      <Suspense fallback={<LoadingRows label="Loading your diary" />}>
        <Diary searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Diary({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const result = await getDiaryOverview();
  if (result.status === "signed-out") return <SignInPrompt what="study diary" returnTo="/diary" />;
  const { entries, totals, upcoming, courses } = result.data;
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
        Your diary fills itself as you study. Open a course in <Link href="/courses">Courses</Link> and choose <strong>Study</strong> on a
        topic: what you read, the authorities you met and how you recalled them will appear here.
      </p>
    );
  }
  const filter = readDiaryFilter(await searchParams);
  const shown = filterDiary(entries, filter);
  const topics = [...new Map(entries.map((e) => [e.topicId, { id: e.topicId, name: e.topicName }])).values()];
  return (
    <>
      <DiaryStats totals={totals} />
      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming" className="flex flex-col gap-2">
          <h2 id="upcoming" className="text-lg font-medium">
            Upcoming revision
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {upcoming.map((item) => (
              <li key={item.topicId}>
                <Link href={`/study/${item.topicId}`}>{item.topicName}</Link>
                <span className="text-muted">
                  {" "}
                  · {item.count} point{item.count === 1 ? "" : "s"} · from {formatWat(item.dueAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="timeline" className="flex flex-col gap-3">
        <h2 id="timeline" className="text-lg font-medium">
          Timeline
        </h2>
        <DiaryFilters filter={filter} courses={courses} topics={topics} />
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">
            Nothing matches these filters. <Link href="/diary">Clear filters</Link>
          </p>
        ) : (
          <DiaryTimeline entries={shown} />
        )}
      </section>
    </>
  );
}
