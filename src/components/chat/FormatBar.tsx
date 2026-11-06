"use client";

import { Icon, type IconName } from "@/components/ui/Icon";

export type Format = "bold" | "italic" | "underline" | "strike" | "link" | "ul" | "ol" | "quote" | "code";

const BUTTONS: { f: Format; label: string; keys?: string; text?: string; icon?: IconName; cls?: string }[] = [
  { f: "bold", label: "Bold", keys: "Ctrl+B", text: "B", cls: "font-bold" },
  { f: "italic", label: "Italic", keys: "Ctrl+I", text: "I", cls: "italic font-serif text-[17px]" },
  { f: "underline", label: "Underline", keys: "Ctrl+U", text: "U", cls: "underline underline-offset-2" },
  { f: "strike", label: "Strikethrough", text: "S", cls: "line-through" },
  { f: "link", label: "Link", keys: "Ctrl+K", icon: "link" },
  { f: "ol", label: "Numbered list", icon: "listNumber" },
  { f: "ul", label: "Bullet list", icon: "listBullet" },
  { f: "quote", label: "Quote", icon: "quote" },
  { f: "code", label: "Code", icon: "code" },
];

// The formatting row above the message box, as in Slack: each button wraps the selected words;
// Link opens the "Add link" box.
export function FormatBar({ onFormat, disabled }: { onFormat: (f: Format) => void; disabled?: boolean }) {
  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-0.5 overflow-x-auto px-2 pt-1.5">
      {BUTTONS.map((b, i) => (
        <span key={b.f} className="flex items-center">
          {(i === 4 || i === 5 || i === 7) && <span aria-hidden className="mx-1 h-4 w-px bg-line" />}
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat(b.f)}
            aria-label={b.label}
            title={b.keys ? `${b.label} (${b.keys})` : b.label}
            className={`flex size-8 items-center justify-center rounded-md text-[15px] text-muted hover:bg-pill hover:text-ink disabled:opacity-40 ${b.cls ?? ""}`}
          >
            {b.icon ? <Icon name={b.icon} size={17} /> : b.text}
          </button>
        </span>
      ))}
    </div>
  );
}

// Applies a format to the text around the selection; returns the new text and selection.
export function applyFormat(text: string, start: number, end: number, f: Format): { text: string; start: number; end: number } {
  const picked = text.slice(start, end);
  const wrap = (open: string, close: string, placeholder: string) => {
    const inner = picked || placeholder;
    const next = text.slice(0, start) + open + inner + close + text.slice(end);
    return { text: next, start: start + open.length, end: start + open.length + inner.length };
  };
  if (f === "bold") return wrap("**", "**", "bold text");
  if (f === "italic") return wrap("_", "_", "italic text");
  if (f === "underline") return wrap("++", "++", "underlined text");
  if (f === "strike") return wrap("~~", "~~", "struck text");
  if (f === "code" && picked.includes("\n")) return wrap("```\n", "\n```", "");
  if (f === "code") return wrap("`", "`", "code");
  // Links are added with the "Add link" box (LinkDialog), not typed markers.
  if (f === "link") return { text, start, end };
  // Lists and quotes mark every line the selection touches.
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lines = text.slice(lineStart, end).split("\n");
  const marked = lines.map((l, i) => (f === "ul" ? "- " : f === "ol" ? `${i + 1}. ` : "> ") + l.replace(/^(\s*([-*•]|\d+[.)]|>)\s+)/, "")).join("\n");
  const next = text.slice(0, lineStart) + marked + text.slice(end);
  return { text: next, start: lineStart + marked.length, end: lineStart + marked.length };
}
