import type { TopicProgress } from "@/lib/progress";
import { MasteryBar } from "./MasteryBar";
import { RevisePick } from "./RevisePick";

// The topics most worth revising: the largest share of slipping points first (Phase 4b).
export function WeakestTopics({ topics }: { topics: TopicProgress[] }) {
  return (
    <section aria-labelledby="weakest" className="flex flex-col gap-2">
      <h2 id="weakest" className="text-lg font-medium">
        Worth revising first
      </h2>
      {topics.length === 0 ? (
        <p className="text-muted">Nothing is slipping right now. Keep answering your revision questions and this stays empty.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {topics.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="break-words font-medium">{t.name}</p>
                <p className="text-sm text-muted">
                  {t.courseName} · <span className="text-warning">{t.slipping} slipping</span> of {t.points}
                  {t.accuracy !== null ? ` · ${t.accuracy}% recalled` : ""}
                </p>
                <MasteryBar label={t.name} mastered={t.mastered} learning={t.learning} slipping={t.slipping} />
              </div>
              <RevisePick topicId={t.id} dueNow={t.dueNow} className="self-start sm:self-center" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
