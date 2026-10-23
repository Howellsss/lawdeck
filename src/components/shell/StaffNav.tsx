"use client";

import { Icon } from "@/components/ui/Icon";
import { NavLink } from "./NavLink";
import { useSidebar } from "./sidebarContext";

export function StaffNav() {
  const { collapsed, onNavigate } = useSidebar();
  const itemClass = (active: boolean) =>
    `flex h-11 items-center gap-3 rounded-lg px-2 text-[15px] no-underline hover:bg-pill ${
      active ? "bg-pill font-medium" : ""
    } ${collapsed ? "justify-center" : ""}`;
  return (
    <>
      <NavLink href="/admin/library" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="scale" />
        <span className={collapsed ? "sr-only" : ""}>Library</span>
      </NavLink>
      <NavLink href="/admin/rubrics" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="pen" />
        <span className={collapsed ? "sr-only" : ""}>Marking guides</span>
      </NavLink>
      <NavLink href="/admin/templates" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="document" />
        <span className={collapsed ? "sr-only" : ""}>Templates</span>
      </NavLink>
      <NavLink href="/admin/eval" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="check" />
        <span className={collapsed ? "sr-only" : ""}>Answer tests</span>
      </NavLink>
    </>
  );
}
