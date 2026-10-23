import type { Run, SheetBlock, StudySheet } from "@/server/exports/sheet";

// A study sheet as a page to print or save as PDF (PRD EX-03): the same content as the Word file.
// On screen it follows the theme; printed, it is black on white.
export function SheetView({ sheet }: { sheet: StudySheet }) {
  return (
    <article className="study-sheet flex w-full max-w-3xl flex-col gap-3 break-words rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed text-ink print:max-w-none print:rounded-none print:border-0 print:p-0">
      <h1 className="font-serif text-3xl font-normal text-greeting">{sheet.title}</h1>
      <p className="text-sm text-muted">{sheet.subtitle}</p>
      {sheet.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </article>
  );
}

function Text({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, index) => (run.bold ? <strong key={index}>{run.text}</strong> : <span key={index}>{run.text}</span>))}
    </>
  );
}

function Block({ block }: { block: SheetBlock }) {
  switch (block.kind) {
    case "heading":
      return <h2 className="mt-3 break-after-avoid text-lg font-semibold">{block.text}</h2>;
    case "subheading":
      return <h3 className="mt-1 break-after-avoid font-semibold">{block.text}</h3>;
    case "paragraph":
      return (
        <p className={block.muted ? "text-sm text-muted" : undefined}>
          <Text runs={block.runs} />
        </p>
      );
    case "bullets":
      return (
        <ul className={`list-disc space-y-1 pl-5 ${block.muted ? "text-sm text-muted" : ""}`}>
          {block.items.map((item, index) => (
            <li key={index}>
              <Text runs={item} />
            </li>
          ))}
        </ul>
      );
  }
}
