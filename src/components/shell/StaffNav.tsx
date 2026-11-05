"use client";

import { Icon } from "@/components/ui/Icon";
import { NavLink } from "./NavLink";
import { NAV_ICON_SIZE, navItemClass } from "./navStyles";
import { SidebarSection } from "./SidebarSection";
import { useSidebar } from "./sidebarContext";

export function StaffNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const { collapsed, onNavigate } = useSidebar();
  const itemClass = (active: boolean) => navItemClass(active, collapsed);
  // Staff pages fold under "Admin", so the student-facing menu stays calm.
  return (
    <SidebarSection title="Admin">
      <NavLink href="/admin/library" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="scale" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Library</span>
      </NavLink>
      <NavLink href="/admin/lessons" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="book" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Lessons</span>
      </NavLink>
      <NavLink href="/admin/rubrics" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="pen" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Marking guides</span>
      </NavLink>
      <NavLink href="/admin/templates" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="document" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Templates</span>
      </NavLink>
      <NavLink href="/admin/reports" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="bookmark" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Reports</span>
      </NavLink>
      <NavLink href="/admin/takedowns" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="close" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Takedowns</span>
      </NavLink>
      <NavLink href="/admin/eval" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="check" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Answer tests</span>
      </NavLink>
      <NavLink href="/admin/voice" onNavigate={onNavigate} className={itemClass} match="prefix">
        <Icon name="speaker" size={NAV_ICON_SIZE} />
        <span className={collapsed ? "sr-only" : ""}>Voice test</span>
      </NavLink>
      {isAdmin && (
        <NavLink href="/admin/users" onNavigate={onNavigate} className={itemClass} match="prefix">
          <Icon name="users" size={NAV_ICON_SIZE} />
          <span className={collapsed ? "sr-only" : ""}>Users</span>
        </NavLink>
      )}
      {isAdmin && (
        <NavLink href="/admin/pilot" onNavigate={onNavigate} className={itemClass} match="prefix">
          <Icon name="flag" size={NAV_ICON_SIZE} />
          <span className={collapsed ? "sr-only" : ""}>Pilot</span>
        </NavLink>
      )}
    </SidebarSection>
  );
}
