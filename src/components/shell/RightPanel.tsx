"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { PanelContent } from "./panelContext";

const panelButton = "flex size-10 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink";

// The third pane. Closed until a screen opens it. Side panel on desktop, full-screen sheet on phones.
// On desktop the expand button makes it fill the screen (founder, 2026-10-25); Escape shrinks it
// back first, then closes it.
export function RightPanel({ content, onClose }: { content: PanelContent | null; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Remembered by panel title, so opening another source in the same panel keeps its size.
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);

  useEffect(() => {
    if (content) headingRef.current?.focus(); // move focus into the panel when it opens (WS-04)
  }, [content]);

  if (!content) return null;
  const expanded = expandedTitle === content.title;
  const setExpanded = (value: boolean) => setExpandedTitle(value ? content.title : null);

  function close() {
    setExpanded(false);
    onClose();
  }

  return (
    <aside
      aria-label={content.title}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (expanded) setExpanded(false);
        else close();
      }}
      className={`fixed inset-0 z-50 flex flex-col bg-surface ${
        expanded ? "md:bg-sidebar" : "md:static md:z-auto md:w-[440px] md:shrink-0 md:border-l md:border-line md:bg-sidebar"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 ref={headingRef} tabIndex={-1} className="text-[15px] font-semibold outline-none">
          {content.title}
        </h2>
        <div className="flex items-center gap-1">
          {/* Phones already show the panel full screen, so the button is for wider screens only. */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Shrink panel" : "Expand panel to full screen"}
            aria-pressed={expanded}
            className={`hidden md:flex ${panelButton}`}
          >
            <Icon name={expanded ? "collapse" : "expand"} size={16} />
          </button>
          <button type="button" onClick={close} aria-label="Close panel" className={panelButton}>
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
      <div className={`flex-1 overflow-auto p-5 ${expanded ? "md:mx-auto md:w-full md:max-w-5xl" : ""}`}>{content.body}</div>
    </aside>
  );
}
