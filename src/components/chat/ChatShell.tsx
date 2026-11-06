import type { ReactNode } from "react";
import type { ChatGroup, ChatInvite } from "@/server/chat/data";
import { ChatGroupNav } from "./ChatGroupNav";
import { ChatHeader, type ChatTab } from "./ChatHeader";

// Campus chat's frame: the group list on the left (a menu on phones), the open group's header with
// members, search and tabs, and the page filling the rest of the screen.
export function ChatShell({
  groups,
  group,
  tab = "messages",
  ownCampusName,
  invites = [],
  children,
}: {
  groups: ChatGroup[];
  group: ChatGroup;
  tab?: ChatTab;
  ownCampusName: string | null;
  invites?: ChatInvite[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-52px)] min-h-0 w-full lg:h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line md:flex">
        <div className="flex h-14 items-center px-4">
          <p className="font-serif text-xl">Campus chat</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatGroupNav groups={groups} current={group.key} ownCampusName={ownCampusName} invites={invites} />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <ChatHeader groups={groups} group={group} ownCampusName={ownCampusName} invites={invites} tab={tab} />
        {children}
      </section>
    </div>
  );
}
