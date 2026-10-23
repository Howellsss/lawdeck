"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { paginate } from "@/lib/paginate";
import type { DocModel } from "@/server/documents/render";
import { PAPER_MM } from "@/server/documents/layout";
import { itemSpacing, PreviewItem, type Item } from "./PreviewItem";

// Drawing a document as pages (steps 5e and 5h), shared by the right panel, the print view
// ("Save as PDF") and the export test, so all three break pages in the same places.

const PX_PER_MM = 96 / 25.4;
const PX_PER_PT = 96 / 72;

export type PageLayout = {
  page: { width: number; height: number };
  margins: { top: number; right: number; bottom: number; left: number };
  contentHeight: number;
  lineHeight: number;
  textStyle: CSSProperties;
};

// The court's paper, margins and type, in screen pixels at real size.
export function layoutFor(profile: DocModel["profile"]): PageLayout {
  const paper = PAPER_MM[profile.paper];
  const margins = {
    top: profile.marginsMm.top * PX_PER_MM,
    right: profile.marginsMm.right * PX_PER_MM,
    bottom: profile.marginsMm.bottom * PX_PER_MM,
    left: profile.marginsMm.left * PX_PER_MM,
  };
  const page = { width: paper.width * PX_PER_MM, height: paper.height * PX_PER_MM };
  const lineHeight = profile.fontSizePt * profile.lineSpacing * 1.15 * PX_PER_PT;
  return {
    page,
    margins,
    contentHeight: page.height - margins.top - margins.bottom,
    lineHeight,
    textStyle: {
      fontFamily: `"${profile.font}", "Times New Roman", serif`,
      fontSize: profile.fontSizePt * PX_PER_PT,
      lineHeight: `${lineHeight}px`,
    },
  };
}

// Headings and paragraphs in order, with Word's rules: a heading keeps with the next paragraph,
// and a part may start a new page (after a cover page, or an affidavit after its motion).
export function toItems(model: DocModel): Item[] {
  return model.blocks.flatMap((block) => {
    const items: Item[] = [];
    if (block.heading) items.push({ partId: block.partId, kind: "heading", text: block.heading, align: "center", keepWithNext: block.paragraphs.length > 0 });
    for (const paragraph of block.paragraphs) items.push({ partId: block.partId, kind: "paragraph", paragraph, align: block.align });
    if (items[0] && block.pageBreakBefore) items[0].newPage = true;
    return items;
  });
}

// Measures every heading and paragraph at real size (again whenever the document changes) and
// places them on pages. `measurer` must be rendered somewhere on the page; it is invisible.
export function useMeasuredPages(model: DocModel): { items: Item[]; heights: number[] | null; pages: number[][]; layout: PageLayout; measurer: ReactNode } {
  const layout = useMemo(() => layoutFor(model.profile), [model.profile]);
  const items = useMemo(() => toItems(model), [model]);
  const measureRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<number[] | null>(null);

  // The browser rounds line boxes to whole pixels, which adds up over a page; Word does not. So
  // each item's height is worked out as Word does: its number of lines times the line height,
  // plus its spacing.
  useLayoutEffect(() => {
    const children = measureRef.current?.children;
    if (!children) return;
    setHeights(
      Array.from(children, (child, i) => {
        const spacing = itemSpacing(items[i]);
        const lines = Math.max(1, Math.round((child.getBoundingClientRect().height - spacing) / layout.lineHeight));
        return lines * layout.lineHeight + spacing;
      }),
    );
  }, [items, layout.lineHeight]);

  const pages = heights
    ? paginate(
        items.map((item, i) => ({ height: heights[i] ?? 0, keepWithNext: item.keepWithNext, newPage: item.newPage })),
        layout.contentHeight,
      )
    : [];
  const measurer = (
    <div
      aria-hidden
      className="pointer-events-none invisible absolute left-0 top-0 -z-10 print:hidden"
      style={{ ...layout.textStyle, width: layout.page.width - layout.margins.left - layout.margins.right }}
    >
      <div ref={measureRef} className="flow-root">
        {items.map((item, i) => (
          <div key={i} className="flow-root">
            <PreviewItem item={item} />
          </div>
        ))}
      </div>
    </div>
  );
  return { items, heights, pages, layout, measurer };
}

// One printed page at real size, scaled for the screen (scale 1 when printing).
export function PageSheet({
  number,
  indexes,
  items,
  heights,
  layout,
  profile,
  scale,
  onPlaceholder,
}: {
  number: number;
  indexes: number[];
  items: Item[];
  heights?: number[];
  layout: PageLayout;
  profile: DocModel["profile"];
  scale: number;
  onPlaceholder?: Parameters<typeof PreviewItem>[0]["onPlaceholder"];
}) {
  const { page, margins, contentHeight, textStyle } = layout;
  return (
    <div style={{ width: page.width * scale, height: page.height * scale }} className="print-page shrink-0">
      <article
        aria-label={`Page ${number}`}
        className="sheet relative bg-sheet text-sheet-ink shadow-sm ring-1 ring-line print:shadow-none print:ring-0"
        style={{ width: page.width, height: page.height, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <div className="absolute overflow-hidden" style={{ ...textStyle, top: margins.top, left: margins.left, right: margins.right, height: contentHeight }}>
          {indexes.map((i) => (
            <div key={i} className="flow-root" data-part={items[i].partId} style={heights ? { height: heights[i] } : undefined}>
              <PreviewItem item={items[i]} onPlaceholder={onPlaceholder} />
            </div>
          ))}
        </div>
        <PageNumber position={profile.pageNumbers} number={number} margins={margins} style={textStyle} />
      </article>
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
  margins: PageLayout["margins"];
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
