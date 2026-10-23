"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChatSummary } from "@/server/db/workspace";
import { useSidebar } from "./sidebarContext";

// Recents in the left menu. Hidden when the menu is collapsed to icons.
export function RecentsList({ chats, message }: { chats?: ChatSummary[]; message?: string }) {
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
              <li key={chat.id}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`block truncate rounded-lg px-2 py-2 text-sm no-underline hover:bg-pill ${
                    pathname === href ? "bg-pill font-medium" : ""
                  }`}
                >
                  {chat.title}
                </Link>
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
