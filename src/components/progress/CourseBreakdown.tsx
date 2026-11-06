import Link from "next/link";
import type { CourseProgress } from "@/lib/progress";
import { MasteryBar, MasteryCounts } from "./MasteryBar";
import { RevisePick } from "./RevisePick";

// Each course and its topics (Phase 4b): what is mastered, learning and slipping, recall accuracy,
// and what is due now. A course opens to show its topics.
export function CourseBreakdown({ courses }: { courses: CourseProgress[] }) {
  return (
    <section aria-labelledby="by-course" className="flex flex-col gap-2">
      <h2 id="by-course" className="text-lg font-medium">
        By course and topic
      </h2>
      <div className="flex flex-col gap-2">
        {courses.map((c) => (
          <details key={c.slug} className="group rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-muted">
                  {c.topics.length} topic{c.topics.length === 1 ? "" : "s"} · {c.accuracy === null ? "no answers yet" : `${c.accuracy}% recalled`}
                  {c.dueNow ? ` · ${c.dueNow} due` : ""}
                  <span aria-hidden className="ml-2 inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>
                </span>
              </span>
              <MasteryBar label={c.name} mastered={c.mastered} learning={c.learning} slipping={c.slipping} />
              <MasteryCounts mastered={c.mastered} learning={c.learning} slipping={c.slipping} />
            </summary>
            <ul className="flex flex-col divide-y divide-line border-t border-line">
              {c.topics.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link href={`/study/${t.id}`} className="break-words">
                      {t.name}
                    </Link>
                    <p className="text-sm text-muted">
                      {t.mastered} mastered · {t.learning} learning · {t.slipping} slipping
                      {t.accuracy !== null ? ` · ${t.accuracy}% recalled` : ""}
                    </p>
                    <MasteryBar label={t.name} mastered={t.mastered} learning={t.learning} slipping={t.slipping} />
                  </div>
                  <RevisePick topicId={t.id} dueNow={t.dueNow} className="self-start sm:self-center" />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
