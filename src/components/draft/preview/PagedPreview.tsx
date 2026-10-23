"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import type { DocModel } from "@/server/documents/render";
import { PageSheet, useMeasuredPages } from "./pages";
import type { PreviewItem } from "./PreviewItem";
import { usePreview } from "./previewStore";

export { toItems } from "./pages";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// The document as printed pages in the right panel (PRD 7.1, DR-05), drawn from the same model
// as the Word file (rule H-04): the court's paper, margins, font, spacing and page numbers. The
// pages are scaled to fit the panel, with zoom for phones.
export function PagedPreview() {
  const { model, caption, onPlaceholder } = usePreview();
  if (!model) return <p className="text-sm text-muted">Nothing to show yet.</p>;
  return <PageView key={model.title} model={model} caption={caption} onPlaceholder={onPlaceholder} />;
}

// Also used on its own, read-only, for documents shared with a student (step 6d).
export function PageView({ model, caption, onPlaceholder }: { model: DocModel; caption?: string; onPlaceholder?: Parameters<typeof PreviewItem>[0]["onPlaceholder"] }) {
  const { items, heights, pages, layout, measurer } = useMeasuredPages(model);
  const frameRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(layout.page.width);
  const [zoom, setZoom] = useState(1);

  // Fit the page to the panel's width.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setFitWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(1, fitWidth / layout.page.width) * zoom;
  const zoomIndex = ZOOMS.indexOf(zoom);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {caption && <p className="mr-auto text-sm text-muted">{caption}</p>}
        <span className="text-sm text-muted" aria-live="polite">
          {pages.length} {pages.length === 1 ? "page" : "pages"} · {Math.round(scale * 100)}%
        </span>
        <button type="button" aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => setZoom(ZOOMS[zoomIndex - 1])} className={compactSecondaryButton}>
          −
        </button>
        <button type="button" aria-label="Zoom in" disabled={zoomIndex >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[zoomIndex + 1])} className={compactSecondaryButton}>
          +
        </button>
      </div>
      {measurer}
      <div ref={frameRef} className="w-full overflow-x-auto">
        <div className="flex flex-col items-center gap-4" aria-label={`${model.title}, as it will print`}>
          {pages.map((indexes, number) => (
            <PageSheet
              key={number}
              number={number + 1}
              indexes={indexes}
              items={items}
              heights={heights ?? undefined}
              layout={layout}
              profile={model.profile}
              scale={scale}
              onPlaceholder={onPlaceholder}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
