"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import type { PanelContent } from "./panelContext";

// The third pane. Closed until a screen opens it. Side panel on desktop, full-screen sheet on phones.
export function RightPanel({ content, onClose }: { content: PanelContent | null; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (content) headingRef.current?.focus(); // move focus into the panel when it opens (WS-04)
  }, [content]);

  if (!content) return null;

  return (
    <aside
      aria-label={content.title}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      className="fixed inset-0 z-50 flex flex-col bg-surface md:static md:z-auto md:w-[440px] md:shrink-0 md:border-l md:border-line md:bg-sidebar"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 ref={headingRef} tabIndex={-1} className="text-[15px] font-semibold outline-none">
          {content.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-pill"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-5">{content.body}</div>
    </aside>
  );
}
