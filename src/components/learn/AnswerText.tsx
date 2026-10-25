import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

// How citation markers show: "labels" as S1, S2 … (briefs, practice, marking), or "links" as a
// small book icon that opens the passage, for Learn answers, which name every authority in full
// (founder, 2026-10-25: "instead of S1, S2, the authorities cited in full").
export type MarkerStyle = "labels" | "links";

// Shows an answer's simple formatting: "## " headings, "- " bullet lines, **bold** and the
// citation markers [S1], [S2] … (buttons once the answer's sources are known). Text is
// always rendered as text, never as HTML.
export function AnswerText({
  text,
  onCite,
  citable,
  markers = "labels",
}: {
  text: string;
  onCite?: (label: number) => void;
  citable: Set<number>;
  markers?: MarkerStyle;
}) {
  const inline = (line: string) => inlineParts(line, onCite, citable, markers);
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {bullets.map((line, i) => (
          <li key={i}>{inline(line)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*•]\s+/, ""));
      continue;
    }
    flushBullets();
    if (!line.trim()) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <h3
          key={`h-${blocks.length}`}
          className="pt-2 text-[15px] font-semibold"
        >
          {inline(heading[1])}
        </h3>,
      );
    } else {
      blocks.push(
        <p key={`p-${blocks.length}`}>{inline(line)}</p>,
      );
    }
  }
  flushBullets();
  return (
    <div className="flex flex-col gap-2 break-words text-[15px] leading-relaxed">
      {blocks}
    </div>
  );
}

// **bold** and [S1] markers inside one line.
function inlineParts(
  text: string,
  onCite: ((label: number) => void) | undefined,
  citable: Set<number>,
  markers: MarkerStyle,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[S(\d+)\]/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      parts.push(<strong key={match.index}>{match[1]}</strong>);
    } else {
      const label = Number(match[2]);
      const canOpen = onCite && citable.has(label);
      if (markers === "links") {
        // While the answer is still being written, nothing shows; afterwards, a small link.
        if (onCite && canOpen)
          parts.push(
            <button
              key={match.index}
              type="button"
              onClick={() => onCite(label)}
              aria-label="Open the passage this comes from"
              title="Open the passage this comes from"
              className="mx-0.5 inline-flex size-5 items-center justify-center rounded-md border border-line align-text-bottom text-muted hover:bg-pill hover:text-ink"
            >
              <Icon name="book" size={12} />
            </button>,
          );
        last = match.index + match[0].length;
        continue;
      }
      parts.push(
        onCite && canOpen ? (
          <button
            key={match.index}
            type="button"
            onClick={() => onCite(label)}
            aria-label={`Open source ${label}`}
            className="mx-0.5 rounded-md border border-line px-1.5 text-xs font-medium underline underline-offset-2 hover:bg-pill"
          >
            S{label}
          </button>
        ) : (
          <span
            key={match.index}
            className="mx-0.5 rounded-md border border-line px-1.5 text-xs text-muted"
          >
            S{label}
          </span>
        ),
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
