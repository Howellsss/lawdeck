import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ChatGroup } from "@/server/chat/data";
import { ChatGroupNav } from "./ChatGroupNav";

// Campus chat's frame: the group list on the left (a menu on phones), the open group's header with
// search, and the conversation filling the rest of the screen.
export function ChatShell({
  groups,
  current,
  title,
  subtitle,
  ownCampusName,
  children,
}: {
  groups: ChatGroup[];
  current: string;
  title: string;
  subtitle: string;
  ownCampusName: string | null;
  children: ReactNode;
}) {
  const unreadElsewhere = groups.filter((g) => g.key !== current).reduce((n, g) => n + g.unread, 0);
  return (
    <div className="flex h-[calc(100dvh-52px)] min-h-0 w-full lg:h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line md:flex">
        <div className="flex h-14 items-center border-b border-line px-4">
          <p className="font-serif text-xl">Campus chat</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatGroupNav groups={groups} current={current} ownCampusName={ownCampusName} />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 lg:px-6">
          <details className="relative md:hidden">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg border border-line px-2 text-[14px]" aria-label="Choose a group">
              <Icon name="hash" size={14} />
              {unreadElsewhere > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold text-on-ink">{unreadElsewhere}</span>}
            </summary>
            <div className="absolute left-0 top-11 z-30 w-64 rounded-xl border border-line bg-paper shadow-lg">
              <ChatGroupNav groups={groups} current={current} ownCampusName={ownCampusName} />
            </div>
          </details>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1 truncate text-[17px] font-semibold">
              <Icon name="hash" size={16} />
              {title}
            </h1>
            <p className="truncate text-[12px] text-muted">{subtitle}</p>
          </div>
          <form action="/chat/search" className="hidden sm:block">
            <label htmlFor="chat-search" className="sr-only">
              Search chat
            </label>
            <input
              id="chat-search"
              name="q"
              type="search"
              placeholder="Search chat"
              className="h-9 w-56 rounded-lg border border-line bg-surface px-3 text-[14px] placeholder:text-muted"
            />
          </form>
          <Link href="/chat/search" aria-label="Search chat" className="flex size-9 items-center justify-center rounded-lg border border-line sm:hidden">
            <Icon name="search" size={16} />
          </Link>
        </header>
        {children}
      </section>
    </div>
  );
}
