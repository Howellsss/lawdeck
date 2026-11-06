import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { ChatGroup, ChatInvite } from "@/server/chat/data";
import { ChatGroupNav } from "./ChatGroupNav";

export const SUBTITLES: Record<ChatGroup["kind"], (name: string) => string> = {
  all: () => "Students from every campus · everyone can read and post",
  campus: (name) => `${name} campus · everyone can read and post`,
  aspirants: () => "Final-year students preparing for Law School",
  study: () => "Private study group · only members can see it",
};

export type ChatTab = "messages" | "files" | "members";

// The top of a group, as in Slack: its name and how many members it has (a number only, never a
// list), search inside the group, and the Messages and Files & links tabs.
export function ChatHeader({
  groups,
  group,
  ownCampusName,
  invites,
  tab,
}: {
  groups: ChatGroup[];
  group: ChatGroup;
  ownCampusName: string | null;
  invites: ChatInvite[];
  tab: ChatTab;
}) {
  const unreadElsewhere = groups.filter((g) => g.key !== group.key).reduce((n, g) => n + g.unread, 0) + invites.length;
  const tabClass = (on: boolean) =>
    `flex items-center gap-1.5 border-b-2 px-1 pb-2 pt-1 text-[14px] no-underline ${on ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`;
  return (
    <header className="shrink-0 border-b border-line px-4 lg:px-6">
      <div className="flex h-14 items-center gap-3">
        <details className="relative md:hidden">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg border border-line px-2 text-[14px]" aria-label="Choose a group">
            <Icon name="hash" size={14} />
            {unreadElsewhere > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold text-on-ink">{unreadElsewhere}</span>}
          </summary>
          <div className="absolute left-0 top-11 z-30 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-line bg-paper shadow-lg">
            <ChatGroupNav groups={groups} current={group.key} ownCampusName={ownCampusName} invites={invites} />
          </div>
        </details>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1 truncate text-[17px] font-semibold">
            <Icon name={group.kind === "study" ? "users" : "hash"} size={16} />
            {group.name}
          </h1>
          <p className="truncate text-[12px] text-muted">{SUBTITLES[group.kind](group.name)}</p>
        </div>
        <p className="flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[13px]" title={`${group.members} member${group.members === 1 ? "" : "s"}`}>
          <Icon name="users" size={15} />
          {group.members}
          <span className="sr-only"> member{group.members === 1 ? "" : "s"}</span>
        </p>
        <form action="/chat/search" className="hidden lg:block" role="search">
          <input type="hidden" name="in" value={group.key} />
          <label htmlFor="chat-search" className="sr-only">
            Search {group.name}
          </label>
          <input
            id="chat-search"
            name="q"
            type="search"
            placeholder={`Search ${group.name}`}
            className="h-9 w-56 rounded-lg border border-line bg-surface px-3 text-[14px] placeholder:text-muted"
          />
        </form>
        <Link href={`/chat/search?in=${group.key}`} aria-label={`Search ${group.name}`} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line lg:hidden">
          <Icon name="search" size={16} />
        </Link>
      </div>
      <nav aria-label="Group pages" className="-mb-px flex gap-5 overflow-x-auto whitespace-nowrap">
        <Link href={`/chat/${group.key}`} aria-current={tab === "messages" ? "page" : undefined} className={tabClass(tab === "messages")}>
          <Icon name="chat" size={15} />
          Messages
        </Link>
        <Link href={`/chat/${group.key}/files`} aria-current={tab === "files" ? "page" : undefined} className={tabClass(tab === "files")}>
          <Icon name="paperclip" size={15} />
          Files &amp; links
        </Link>
        {group.kind === "study" && (
          <Link href={`/chat/${group.key}/members`} aria-current={tab === "members" ? "page" : undefined} className={tabClass(tab === "members")}>
            <Icon name="users" size={15} />
            Members
          </Link>
        )}
      </nav>
    </header>
  );
}
