"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatMenu } from "@/components/learn/ChatMenu";
import type { ProjectOption } from "@/components/learn/ChatMoveForm";
import type { RecentChat } from "@/server/db/workspace";
import { useSidebar } from "./sidebarContext";

// Recents in the left menu, each with its ⋯ menu. Hidden when the menu is collapsed to icons.
export function RecentsList({
  chats,
  projects = null,
  message,
}: {
  chats?: RecentChat[];
  projects?: ProjectOption[] | null;
  message?: string;
}) {
  const { collapsed, onNavigate } = useSidebar();
  const pathname = usePathname();
  if (collapsed) return null;

  return (
    <section aria-label="Recents" className="flex min-h-0 flex-col gap-1">
      <h2 className="px-2 text-[13px] font-normal text-muted">Recents</h2>
      {message && <p className="px-2 text-sm text-muted">{message}</p>}
      {chats && (
        <ul className="flex flex-col gap-0.5">
          {chats.map((chat) => {
            const href = `/chats/${chat.id}`;
            return (
              <li key={chat.id} className="flex items-center gap-0.5">
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`block min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-sm no-underline hover:bg-pill ${
                    pathname === href ? "bg-pill font-medium" : ""
                  }`}
                >
                  {chat.title}
                </Link>
                <ChatMenu chat={chat} projects={projects} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RecentsPlaceholder() {
  return <span aria-hidden="true" className="mx-2 h-16 animate-pulse rounded-lg bg-pill" />;
}
