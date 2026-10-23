import type { CSSProperties } from "react";
import type { Paragraph } from "@/server/documents/render";

// One heading or paragraph as it prints. Used both to measure (for page breaks) and on the page.
export type Item = {
  partId: string;
  kind: "heading" | "paragraph";
  text?: string;
  paragraph?: Paragraph;
  align: "left" | "center" | "right" | "justify";
  keepWithNext?: boolean;
  newPage?: boolean;
};

const ALIGN = { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify" } as const;
const PX_PER_PT = 96 / 72;

export const SPACE = { headingBeforePt: 12, paragraphAfterPt: 6 };

// Word fits a justified line by narrowing its spaces, by up to a quarter (LibreOffice does the same
// with Word files; measured in step 5h), where a browser only widens them. A quarter of a Times
// space (a quarter em) is 0.0625 em, so justified text is set that much tighter to wrap where Word
// does; justifying then widens the spaces again.
const JUSTIFY_SPACING = "-0.0625em";

// The space above and below an item, in screen pixels.
export function itemSpacing(item: Item): number {
  return ((item.kind === "heading" ? SPACE.headingBeforePt : 0) + SPACE.paragraphAfterPt) * PX_PER_PT;
}

export function PreviewItem({
  item,
  onPlaceholder,
}: {
  item: Item;
  onPlaceholder?: (target: { field?: string; partId: string }) => void;
}) {
  if (item.kind === "heading") {
    const style: CSSProperties = {
      paddingTop: SPACE.headingBeforePt * PX_PER_PT,
      paddingBottom: SPACE.paragraphAfterPt * PX_PER_PT,
    };
    return (
      <h3 className="text-center font-bold" style={{ ...style, fontSize: "1em" }}>
        {item.text}
      </h3>
    );
  }
  return (
    <p className={`${ALIGN[item.align]} break-words`} style={{ paddingBottom: SPACE.paragraphAfterPt * PX_PER_PT, wordSpacing: item.align === "justify" ? JUSTIFY_SPACING : undefined }}>
      {item.paragraph?.runs.map((run, i) =>
        !run.placeholder ? (
          <span key={i}>{run.text}</span>
        ) : onPlaceholder ? (
          <button
            key={i}
            type="button"
            className="placeholder cursor-pointer"
            aria-label={`Fill in ${run.text}`}
            onClick={() => onPlaceholder({ field: run.field, partId: item.partId })}
          >
            {run.text}
          </button>
        ) : (
          <span key={i} className="placeholder">
            {run.text}
          </span>
        ),
      )}
    </p>
  );
}
