import Link from "next/link";
import { formatDateWat, formatWat } from "@/lib/dates";
import type { DiaryEntrySummary } from "@/server/db/diary";

// The learning timeline (founder's brief, 21): newest day first; each entry opens its full record.
export function DiaryTimeline({ entries }: { entries: DiaryEntrySummary[] }) {
  const days = [...new Set(entries.map((e) => e.date))];
  return (
    <ol aria-label="Study timeline" className="flex flex-col gap-5">
      {days.map((day) => (
        <li key={day} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted">{formatDateWat(day)}</h3>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {entries
              .filter((e) => e.date === day)
              .map((entry) => (
                <li key={entry.sessionId} className="flex flex-col gap-1 px-4 py-3">
                  <Link href={`/diary/${entry.sessionId}`} className="break-words font-medium">
                    {entry.topicName}
                  </Link>
                  <span className="text-sm text-muted">
                    {entry.courseName} · {entry.minutes} min
                    {entry.answered ? ` · ${entry.correct} of ${entry.answered} recalled` : ""}
                    {entry.completed ? " · completed" : ""}
                  </span>
                  <span className={`text-sm ${entry.revision.status === "due" ? "text-warning" : "text-muted"}`}>
                    {entry.revision.status === "due"
                      ? "Due for revision now"
                      : entry.revision.status === "upcoming" && entry.revision.dueAt
                        ? `Next revision ${formatWat(entry.revision.dueAt)}`
                        : "No revision scheduled"}
                  </span>
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
