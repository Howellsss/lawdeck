"use client";

import { createContext, useContext } from "react";

// Lets items inside the sidebar (like the account button) know whether it is collapsed
// and close the mobile menu when a link is pressed.
export const SidebarContext = createContext<{ collapsed: boolean; onNavigate?: () => void }>({ collapsed: false });

export function useSidebar() {
  return useContext(SidebarContext);
}
