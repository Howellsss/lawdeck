import type { CSSProperties } from "react";
import type { Block, DocModel } from "@/server/documents/render";
import { LAYOUT, PAPER_MM } from "@/server/documents/layout";

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
} as const;

// The document as paper on screen, drawn from the same model as the Word file (rule H-04): the
// court's paper size, font, size, line spacing and margins, scaled to fit any screen width.
// Breaking into separate A4 pages comes with the preview panel (step 5e); a cover page already
// sits on its own sheet.
export function DocumentSheet({ model }: { model: DocModel }) {
  const { profile } = model;
  const paper = PAPER_MM[profile.paper];
  const widthPt = (paper.width * 72) / 25.4;
  const pct = (mm: number) => `${(mm / paper.width) * 100}%`;
  const sheetStyle: CSSProperties = {
    paddingTop: pct(profile.marginsMm.top),
    paddingRight: pct(profile.marginsMm.right),
    paddingBottom: pct(profile.marginsMm.bottom),
    paddingLeft: pct(profile.marginsMm.left),
  };
  // Sizes in points become a share of the page width, so the page keeps its proportions.
  const size = (pt: number) => `calc(100cqw * ${pt / widthPt})`;
  const textStyle: CSSProperties = {
    fontFamily: `"${profile.font}", "Times New Roman", serif`,
    fontSize: size(profile.fontSizePt),
    lineHeight: profile.lineSpacing * 1.15,
  };
  const sheets =
    profile.coverPage && model.blocks.length > 1
      ? [model.blocks.slice(0, 1), model.blocks.slice(1)]
      : [model.blocks];

  return (
    <div
      className="flex w-full flex-col gap-4"
      aria-label={`${model.title}, as it will print`}
    >
      {sheets.map((blocks, index) => (
        <div key={index} className="@container w-full">
          <article
            className="sheet w-full bg-sheet text-sheet-ink shadow-sm ring-1 ring-line"
            style={{
              ...sheetStyle,
              minHeight: `calc(100cqw * ${paper.height / paper.width})`,
            }}
          >
            <div style={textStyle}>
              {blocks.map((block) => (
                <SheetBlock key={block.partId} block={block} size={size} />
              ))}
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}

function SheetBlock({
  block,
  size,
}: {
  block: Block;
  size: (pt: number) => string;
}) {
  return (
    <section data-part={block.partId}>
      {block.heading && (
        <h3
          className="text-center font-bold"
          style={{
            fontSize: "1em",
            marginTop: size(LAYOUT.headingBeforePt),
            marginBottom: size(LAYOUT.paragraphAfterPt),
          }}
        >
          {block.heading}
        </h3>
      )}
      {block.paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className={`${ALIGN[block.align]} break-words`}
          style={{ marginBottom: size(LAYOUT.paragraphAfterPt) }}
        >
          {paragraph.runs.map((run, i) =>
            run.placeholder ? (
              <span key={i} className="placeholder">
                {run.text}
              </span>
            ) : (
              <span key={i}>{run.text}</span>
            ),
          )}
        </p>
      ))}
    </section>
  );
}
