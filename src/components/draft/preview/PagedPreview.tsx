"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { paginate } from "@/lib/paginate";
import type { DocModel } from "@/server/documents/render";
import { PAPER_MM } from "@/server/documents/layout";
import { PreviewItem, type Item } from "./PreviewItem";
import { usePreview } from "./previewStore";

const PX_PER_MM = 96 / 25.4;
const PX_PER_PT = 96 / 72;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// The document as printed pages in the right panel (PRD 7.1, DR-05), drawn from the same model
// as the Word file (rule H-04): the court's paper, margins, font, spacing and page numbers. Each
// heading and paragraph is measured at real size and placed on pages; the pages are then scaled
// to fit the panel, with zoom for phones.
export function PagedPreview() {
  const { model, caption, onPlaceholder } = usePreview();
  if (!model) return <p className="text-sm text-muted">Nothing to show yet.</p>;
  return <Pages key={model.title} model={model} caption={caption} onPlaceholder={onPlaceholder} />;
}

function Pages({ model, caption, onPlaceholder }: { model: DocModel; caption?: string; onPlaceholder?: Parameters<typeof PreviewItem>[0]["onPlaceholder"] }) {
  const { profile } = model;
  const paper = PAPER_MM[profile.paper];
  const page = { width: paper.width * PX_PER_MM, height: paper.height * PX_PER_MM };
  const margins = {
    top: profile.marginsMm.top * PX_PER_MM,
    right: profile.marginsMm.right * PX_PER_MM,
    bottom: profile.marginsMm.bottom * PX_PER_MM,
    left: profile.marginsMm.left * PX_PER_MM,
  };
  const contentHeight = page.height - margins.top - margins.bottom;
  const textStyle: CSSProperties = {
    fontFamily: `"${profile.font}", "Times New Roman", serif`,
    fontSize: profile.fontSizePt * PX_PER_PT,
    lineHeight: profile.lineSpacing * 1.15,
  };

  const items = useMemo(() => toItems(model), [model]);
  const measureRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<number[] | null>(null);
  const [fitWidth, setFitWidth] = useState(page.width);
  const [zoom, setZoom] = useState(1);

  // Measure every item at real size, then again whenever the document changes.
  useLayoutEffect(() => {
    const children = measureRef.current?.children;
    if (!children) return;
    setHeights(Array.from(children, (child) => child.getBoundingClientRect().height));
  }, [items]);

  // Fit the page to the panel's width.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setFitWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const pages = heights
    ? paginate(
        items.map((item, i) => ({ height: heights[i] ?? 0, keepWithNext: item.keepWithNext, newPage: item.newPage })),
        contentHeight,
      )
    : [];
  const scale = Math.min(1, fitWidth / page.width) * zoom;
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

      {/* Hidden copy at real size, for measuring. */}
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 -z-10" style={{ ...textStyle, width: page.width - margins.left - margins.right }}>
        <div ref={measureRef} className="flow-root">
          {items.map((item, i) => (
            <div key={i} className="flow-root">
              <PreviewItem item={item} />
            </div>
          ))}
        </div>
      </div>

      <div ref={frameRef} className="w-full overflow-x-auto">
        <div className="flex flex-col items-center gap-4" aria-label={`${model.title}, as it will print`}>
          {pages.map((indexes, number) => (
            <div key={number} style={{ width: page.width * scale, height: page.height * scale }} className="shrink-0">
              <article
                aria-label={`Page ${number + 1}`}
                className="sheet relative bg-sheet text-sheet-ink shadow-sm ring-1 ring-line"
                style={{ width: page.width, height: page.height, transform: `scale(${scale})`, transformOrigin: "top left" }}
              >
                <div className="absolute overflow-hidden" style={{ ...textStyle, top: margins.top, left: margins.left, right: margins.right, height: contentHeight }}>
                  {indexes.map((i) => (
                    <div key={i} className="flow-root">
                      <PreviewItem item={items[i]} onPlaceholder={onPlaceholder} />
                    </div>
                  ))}
                </div>
                <PageNumber position={profile.pageNumbers} number={number + 1} margins={margins} style={textStyle} />
              </article>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageNumber({
  position,
  number,
  margins,
  style,
}: {
  position: DocModel["profile"]["pageNumbers"];
  number: number;
  margins: { top: number; right: number; bottom: number; left: number };
  style: CSSProperties;
}) {
  if (position === "none") return null;
  const place: CSSProperties =
    position === "top-right"
      ? { top: margins.top / 2, right: margins.right, textAlign: "right" }
      : { bottom: margins.bottom / 2, left: margins.left, right: margins.right, textAlign: position === "bottom-centre" ? "center" : "right" };
  return (
    <div className="absolute" style={{ ...style, ...place }}>
      {number}
    </div>
  );
}

// Headings and paragraphs in order, with Word's rules: a heading keeps with the next paragraph,
// and on a cover page the second part starts a new page.
export function toItems(model: DocModel): Item[] {
  return model.blocks.flatMap((block, index) => {
    const items: Item[] = [];
    if (block.heading) items.push({ partId: block.partId, kind: "heading", text: block.heading, align: "center", keepWithNext: block.paragraphs.length > 0 });
    for (const paragraph of block.paragraphs) items.push({ partId: block.partId, kind: "paragraph", paragraph, align: block.align });
    if (items[0] && index === 1 && model.profile.coverPage) items[0].newPage = true;
    return items;
  });
}
