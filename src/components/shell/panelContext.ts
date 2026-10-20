"use client";

import { createContext, useContext, type ReactNode } from "react";

// Lets any screen open the right panel (documents, sources, marking) without knowing how it is drawn.
export type PanelContent = { title: string; body: ReactNode };

export type RightPanelControls = {
  open: (content: PanelContent) => void;
  close: () => void;
};

export const RightPanelContext = createContext<RightPanelControls | null>(null);

export function useRightPanel(): RightPanelControls {
  const controls = useContext(RightPanelContext);
  if (!controls) throw new Error("useRightPanel must be used inside AppShell");
  return controls;
}
