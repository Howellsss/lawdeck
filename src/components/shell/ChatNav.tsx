"use client";

import { Icon } from "@/components/ui/Icon";
import { NavLink } from "./NavLink";
import { NAV_ICON_SIZE, navItemClass } from "./navStyles";
import { useSidebar } from "./sidebarContext";

// "Campus chat" in the side menu, for people chat is open to (docs/specs/chat.md).
export function ChatNav() {
  const { collapsed, onNavigate } = useSidebar();
  return (
    <NavLink href="/chat" onNavigate={onNavigate} className={(active) => navItemClass(active, collapsed)} match="prefix">
      <Icon name="chat" size={NAV_ICON_SIZE} />
      <span className={collapsed ? "sr-only" : ""}>Campus chat</span>
    </NavLink>
  );
}
