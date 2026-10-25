import Link from "next/link";
import { formatWat } from "@/lib/dates";
import type { ItemUsage as Usage } from "@/server/db/sourcePresentation";

// Admins: the answers that relied on this item, each opening its full source trace (migration 37).
export function ItemUsage({ usage }: { usage: Usage }) {
  if (usage.answers === 0) return <p className="text-sm text-muted">No student answer has used this item yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Used in {usage.answers} answer{usage.answers === 1 ? "" : "s"} for {usage.students} student{usage.students === 1 ? "" : "s"}
        {usage.lastUsed && <span className="text-muted"> · last {formatWat(usage.lastUsed)}</span>}
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {usage.answerIds.map((answer) => (
          <li key={answer.id}>
            <Link href={`/admin/answers/${answer.id}`}>Trace the answer of {formatWat(answer.usedAt)}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
