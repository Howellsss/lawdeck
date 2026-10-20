"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { RightPanel } from "./RightPanel";
import { RightPanelContext, type PanelContent } from "./panelContext";
import { Sidebar } from "./Sidebar";

const roundButton =
  "flex size-12 items-center justify-center rounded-full border border-line bg-paper text-ink hover:bg-pill";

// The three-pane workspace: left menu, middle work area, right panel (closed until needed).
// Below 1024 px the left menu becomes a drawer opened from the top bar (PRD 4.1).
export function AppShell({ children, account }: { children: ReactNode; account?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panel, setPanel] = useState<PanelContent | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const panelControls = useMemo(() => ({ open: setPanel, close: () => setPanel(null) }), []);

  useEffect(() => {
    if (drawerOpen) drawerCloseRef.current?.focus();
  }, [drawerOpen]);

  return (
    <RightPanelContext.Provider value={panelControls}>
      <div className="flex min-h-dvh flex-1 bg-paper text-ink">
        <div className={`hidden shrink-0 border-r border-line lg:block ${collapsed ? "w-[76px]" : "w-[280px]"}`}>
          <div className="sticky top-0 h-dvh">
            <Sidebar
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed((value) => !value)}
              account={account}
            />
          </div>
        </div>

        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 flex lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onKeyDown={(event) => event.key === "Escape" && closeDrawer()}
          >
            <div className="h-full w-[min(320px,85vw)] border-r border-line">
              <Sidebar
                onNavigate={closeDrawer}
                account={account}
                closeButton={
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    onClick={closeDrawer}
                    aria-label="Close menu"
                    className="flex size-10 items-center justify-center rounded-full border border-line"
                  >
                    <Icon name="close" size={16} />
                  </button>
                }
              />
            </div>
            <button type="button" aria-label="Close menu" onClick={closeDrawer} className="flex-1 bg-black/50" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between px-4 pt-4 lg:hidden">
            <button type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)} className={roundButton}>
              <Icon name="menu" />
            </button>
            <Link href="/" aria-label="New task" className={`${roundButton} no-underline`}>
              <Icon name="newTask" />
            </Link>
          </header>
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>

        <RightPanel content={panel} onClose={panelControls.close} />
      </div>
    </RightPanelContext.Provider>
  );
}
