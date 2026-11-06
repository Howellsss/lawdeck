import Link from "next/link";

// "Revise now" for a topic: its due questions if any, otherwise its key points to look over.
export function RevisePick({ topicId, dueNow, className = "" }: { topicId: string; dueNow: number; className?: string }) {
  return dueNow > 0 ? (
    <Link
      href={`/revise?topic=${topicId}`}
      className={`inline-flex h-9 shrink-0 items-center rounded-full bg-ink px-4 text-[13.5px] font-medium text-on-ink no-underline ${className}`}
    >
      Revise now ({dueNow})
    </Link>
  ) : (
    <Link
      href={`/study/${topicId}/visual`}
      className={`inline-flex h-9 shrink-0 items-center rounded-full border border-line px-4 text-[13.5px] font-medium no-underline ${className}`}
    >
      Revise visually
    </Link>
  );
}
