"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useSidebar } from "./sidebarContext";

// A small grey heading that folds its links away ("Admin ▾", "Recents ▾"), so the menu stays
// calm. Open by default; the browser remembers nothing, so it opens again on the next page load.
// When the menu is narrowed to icons, the heading is left out and the links show as icons.
export function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  const { collapsed } = useSidebar();
  if (collapsed) return <div className="flex flex-col gap-0.5">{children}</div>;
  return (
    <details open className="group">
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <Icon name="chevronDown" size={12} className="transition-transform group-[:not([open])]:-rotate-90" />
      </summary>
      <div className="mt-0.5 flex flex-col gap-0.5">{children}</div>
    </details>
  );
}
