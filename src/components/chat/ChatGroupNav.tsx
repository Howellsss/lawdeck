import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { ChatGroup } from "@/server/chat/data";

// The list of groups: All campuses, each campus, and Aspirants. Unread groups are bold with a count.
export function ChatGroupNav({ groups, current, ownCampusName }: { groups: ChatGroup[]; current: string; ownCampusName: string | null }) {
  return (
    <nav aria-label="Chat groups" className="flex flex-col gap-0.5 p-2">
      {groups.map((g) => {
        const here = g.key === current;
        return (
          <Link
            key={g.id}
            href={`/chat/${g.key}`}
            aria-current={here ? "page" : undefined}
            className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-[15px] no-underline ${here ? "bg-pill font-medium text-ink" : g.unread ? "font-semibold text-ink hover:bg-pill/60" : "text-muted hover:bg-pill/60 hover:text-ink"}`}
          >
            <Icon name="hash" size={15} />
            <span className="min-w-0 flex-1 truncate">
              {g.name}
              {ownCampusName && g.name === ownCampusName && <span className="ml-1.5 text-[12px] font-normal text-muted">your campus</span>}
            </span>
            {g.unread > 0 && !here && (
              <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold leading-[18px] text-on-ink" aria-label={`${g.unread} unread`}>
                {g.unread > 99 ? "99+" : g.unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
