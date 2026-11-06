import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { LessonCard as Card } from "@/server/chat/data";

// A shared lesson in a message: the topic, its course and Open lesson. It never shows the lesson's
// text. A lesson approved with its course (not read in full) carries the same note as on the lesson.
export function LessonCard({ card }: { card: Card }) {
  return (
    <div className="mt-1.5 flex max-w-md flex-col gap-2 rounded-xl border border-line bg-surface p-3" aria-label={`Lesson: ${card.topic}`} role="group">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pill">
          <Icon name="book" size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-muted">Lesson · {card.course}</p>
          <p className="text-[15px] font-semibold break-words">{card.topic}</p>
        </div>
      </div>
      {card.bulkApproved && <p className="text-[13px] text-warning">Not yet read in full by a reviewer.</p>}
      <Link
        href={`/study/${card.topicId}`}
        className="inline-flex h-9 w-fit items-center justify-center rounded-full border border-line px-4 text-[14px] font-medium hover:bg-pill"
      >
        Open lesson
      </Link>
    </div>
  );
}
