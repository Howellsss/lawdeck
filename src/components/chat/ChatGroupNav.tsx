import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { ChatGroup, ChatInvite } from "@/server/chat/data";
import { InviteRow } from "./InviteRow";
import { NewGroupButton } from "./NewGroupButton";

// The list of groups: campus groups (All campuses, your campus, or Aspirants), then the student's
// private study groups, invitations waiting, and "New study group". Unread groups are bold with a count.
export function ChatGroupNav({
  groups,
  current,
  ownCampusName,
  invites = [],
}: {
  groups: ChatGroup[];
  current: string;
  ownCampusName: string | null;
  invites?: ChatInvite[];
}) {
  const campus = groups.filter((g) => g.kind !== "study");
  const study = groups.filter((g) => g.kind === "study");
  const item = (g: ChatGroup) => {
    const here = g.key === current;
    return (
      <Link
        key={g.id}
        href={`/chat/${g.key}`}
        aria-current={here ? "page" : undefined}
        className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-[15px] no-underline ${here ? "bg-pill font-medium text-ink" : g.unread ? "font-semibold text-ink hover:bg-pill/60" : "text-muted hover:bg-pill/60 hover:text-ink"}`}
      >
        <Icon name={g.kind === "study" ? "users" : "hash"} size={15} />
        <span className="min-w-0 flex-1 truncate">
          {g.name}
          {ownCampusName && g.kind === "campus" && g.name === ownCampusName && <span className="ml-1.5 text-[12px] font-normal text-muted">your campus</span>}
        </span>
        {g.unread > 0 && !here && (
          <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold leading-[18px] text-on-ink" aria-label={`${g.unread} unread`}>
            {g.unread > 99 ? "99+" : g.unread}
          </span>
        )}
      </Link>
    );
  };
  return (
    <nav aria-label="Chat groups" className="flex flex-col gap-0.5 p-2">
      {campus.map(item)}
      <h2 className="mt-4 px-2.5 pb-1 text-[12px] font-medium uppercase tracking-wide text-muted">Study groups</h2>
      {invites.length > 0 && (
        <ul aria-label="Invitations" className="mb-1 flex flex-col gap-1.5">
          {invites.map((i) => (
            <InviteRow key={i.groupId} invite={i} />
          ))}
        </ul>
      )}
      {study.map(item)}
      <NewGroupButton />
    </nav>
  );
}
