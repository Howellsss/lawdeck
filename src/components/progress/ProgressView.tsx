import Link from "next/link";
import type { Progress } from "@/server/db/progress";
import { AccuracyByWeek } from "./AccuracyByWeek";
import { CourseBreakdown } from "./CourseBreakdown";
import { ProgressSummary } from "./ProgressSummary";
import { StudyDaysGrid } from "./StudyDaysGrid";
import { WeakestTopics } from "./WeakestTopics";

// My progress (Remembrance Phase 4b): shared by the page and its layout test.
export function ProgressView({ progress }: { progress: Progress }) {
  if (progress.totals.points === 0 && progress.totals.answered === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
        Your progress appears here once you answer questions while studying. Open a course in <Link href="/courses">Courses</Link> and choose{" "}
        <strong>Study</strong> on a topic.
      </p>
    );
  }
  return (
    <>
      <ProgressSummary totals={progress.totals} streak={progress.days.streak} />
      <WeakestTopics topics={progress.weakest} />
      <div className="grid gap-8 lg:grid-cols-2">
        <AccuracyByWeek weeks={progress.weeks} />
        <StudyDaysGrid days={progress.days} />
      </div>
      <CourseBreakdown courses={progress.courses} />
      <p className="text-xs text-muted">
        Based only on your own recorded answers and revision ({progress.totals.answered} answers). It shows what you have remembered so far; it is not
        a prediction of exam results. A point is mastered when you remembered it last time and it now comes back two weeks or more apart; it is
        slipping when you missed it or only partly remembered it last time, or have found it hard.
      </p>
    </>
  );
}
