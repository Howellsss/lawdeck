"use client";

import { Icon } from "@/components/ui/Icon";
import { NavLink } from "./NavLink";
import { useSidebar } from "./sidebarContext";

export function StaffNav({ isAdmin = false }: { isAdmin?: boolean }) {
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
      <NavLink href="/admin/reports" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="bookmark" />
        <span className={collapsed ? "sr-only" : ""}>Reports</span>
      </NavLink>
      <NavLink href="/admin/takedowns" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="close" />
        <span className={collapsed ? "sr-only" : ""}>Takedowns</span>
      </NavLink>
      <NavLink href="/admin/eval" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="check" />
        <span className={collapsed ? "sr-only" : ""}>Answer tests</span>
      </NavLink>
      <NavLink href="/admin/voice" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="speaker" />
        <span className={collapsed ? "sr-only" : ""}>Voice test</span>
      </NavLink>
      {isAdmin && (
        <NavLink href="/admin/users" onNavigate={onNavigate} className={itemClass} match="prefix">
          <Icon name="users" />
          <span className={collapsed ? "sr-only" : ""}>Users</span>
        </NavLink>
      )}
      {isAdmin && (
        <NavLink href="/admin/pilot" onNavigate={onNavigate} className={itemClass} match="prefix">
          <Icon name="flag" />
          <span className={collapsed ? "sr-only" : ""}>Pilot</span>
        </NavLink>
      )}
    </>
  );
}
