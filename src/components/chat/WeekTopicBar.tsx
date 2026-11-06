import Link from "next/link";
import { dayLabel, watDay } from "@/lib/chatTime";
import type { WeekTopic } from "@/server/chat/data";

const small = "inline-flex h-8 items-center rounded-full border border-line px-3 text-[13px] font-medium hover:bg-pill disabled:opacity-60";

// "This week's topic" at the top of a study group: the topic, who set it and when, and Open lesson.
// The group's creator can set, change or clear it.
export function WeekTopicBar({
  weekTopic,
  canSet,
  busy,
  onSet,
  onClear,
}: {
  weekTopic: WeekTopic | null;
  canSet: boolean;
  busy: boolean;
  onSet: () => void;
  onClear: () => void;
}) {
  if (!weekTopic && !canSet) return null;
  return (
    <section aria-label="This week’s topic" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 lg:px-6">
      {weekTopic ? (
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <p className="text-[12px] text-muted">📌 This week&rsquo;s topic · {weekTopic.card.course}</p>
          <p className="text-[15px] font-semibold break-words">{weekTopic.card.topic}</p>
          <p className="text-[12px] text-muted">
            Set by {weekTopic.setBy} · {dayLabel(watDay(weekTopic.setAt))}
            {weekTopic.card.bulkApproved && <span className="text-warning"> · Not yet read in full by a reviewer</span>}
          </p>
        </div>
      ) : (
        <p className="w-full min-w-0 text-[14px] text-muted sm:w-auto sm:flex-1">Pick a topic for the group to study this week.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {weekTopic && (
          <Link href={`/study/${weekTopic.card.topicId}`} className={`${small} bg-ink text-on-ink hover:bg-ink`}>
            Open lesson
          </Link>
        )}
        {canSet && (
          <button type="button" onClick={onSet} disabled={busy} className={small}>
            {weekTopic ? "Change" : "Set this week’s topic"}
          </button>
        )}
        {canSet && weekTopic && (
          <button type="button" onClick={onClear} disabled={busy} className={small}>
            Clear
          </button>
        )}
      </div>
    </section>
  );
}
