import type { ReactNode } from "react";

// Shows an answer's simple formatting: "## " headings, "- " bullet lines, **bold** and the
// citation markers [S1], [S2] … (buttons once the answer's sources are known). Text is
// always rendered as text, never as HTML.
export function AnswerText({
  text,
  onCite,
  citable,
}: {
  text: string;
  onCite?: (label: number) => void;
  citable: Set<number>;
}) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {bullets.map((line, i) => (
          <li key={i}>{inline(line, onCite, citable)}</li>
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
          {inline(heading[1], onCite, citable)}
        </h3>,
      );
    } else {
      blocks.push(
        <p key={`p-${blocks.length}`}>{inline(line, onCite, citable)}</p>,
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
function inline(
  text: string,
  onCite: ((label: number) => void) | undefined,
  citable: Set<number>,
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
      parts.push(
        onCite && citable.has(label) ? (
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
