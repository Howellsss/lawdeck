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
    <p className={`${ALIGN[item.align]} break-words`} style={{ paddingBottom: SPACE.paragraphAfterPt * PX_PER_PT }}>
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
