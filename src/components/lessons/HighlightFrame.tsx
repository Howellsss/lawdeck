"use client";

import { useState, useSyncExternalStore } from "react";

export type HighlightMode = "full" | "quiet" | "off";
const KEY = "lawdeck-highlights";
const MODES: { value: HighlightMode; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "quiet", label: "Quiet" },
  { value: "off", label: "Off" },
];
const KEYS: { type: string; label: string }[] = [
  { type: "case", label: "Cases" },
  { type: "principle", label: "Principles" },
  { type: "statute", label: "Statutes" },
  { type: "tip", label: "Exam tips" },
  { type: "exception", label: "Exceptions" },
  { type: "definition", label: "Definitions" },
];

function savedMode(): HighlightMode | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "full" || value === "quiet" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

// Wraps a lesson with the highlight choice (founder, 2026-11-05: lessons open fully highlighted;
// students can choose Quiet or Off) and the colour key. The choice is remembered in this browser.
export function HighlightFrame({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(() => () => {}, savedMode, () => null);
  const [chosen, setChosen] = useState<HighlightMode | null>(null);
  const mode = chosen ?? stored ?? "full";

  function choose(next: HighlightMode) {
    setChosen(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing: the choice lasts for this page only.
    }
  }

  return (
    <div data-highlights={mode} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <ul aria-label="Highlight key" className={`flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted ${mode === "off" ? "invisible" : ""}`}>
          {KEYS.map((key) => (
            <li key={key.type} className={`mark-${key.type} flex items-center gap-1.5`}>
              <span aria-hidden="true" className="inline-block size-2 rounded-sm" style={{ background: "var(--hl)" }} />
              {key.label}
            </li>
          ))}
        </ul>
        <fieldset className="flex items-center gap-1 text-[12.5px]">
          <legend className="sr-only">Highlights</legend>
          <span aria-hidden="true" className="mr-1 text-muted">
            Highlights
          </span>
          {MODES.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                mode === option.value ? "border-ink bg-ink text-on-ink" : "border-line text-ink"
              }`}
            >
              <input type="radio" name="highlights" value={option.value} checked={mode === option.value} onChange={() => choose(option.value)} className="sr-only" />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>
      {children}
    </div>
  );
}
