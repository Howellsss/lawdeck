import { formatDateWat } from "@/lib/dates";
import type { RecheckReason } from "@/server/db/lawChanges";

// The out-of-date warning on an item's review page (rule KB-02).
export function RecheckNotice({ reasons }: { reasons: RecheckReason[] }) {
  if (reasons.length === 0) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-2xl border border-warning px-4 py-3 text-sm">
      <p className="font-medium text-warning">
        Needs re-check: the law has changed since this was last checked. Students cannot find it in search until it is
        re-checked.
      </p>
      <ul className="list-disc pl-5">
        {reasons.map((reason) => (
          <li key={`${reason.changeTitle}-${reason.effectiveOn}`}>
            {reason.changeTitle} (took effect {formatDateWat(reason.effectiveOn)})
          </li>
        ))}
      </ul>
      <p className="text-muted">
        Check the passages against the change, correct them if needed, then save a newer “law current as of” date. Or
        withdraw the item.
      </p>
    </div>
  );
}
