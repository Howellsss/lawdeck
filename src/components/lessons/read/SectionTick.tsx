"use client";

import { useId, useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { SectionTick as Tick } from "@/lib/readInFull";
import { tickSection } from "@/server/lessons/readInFull";

// The tick at the end of each section (skim, tick and approve): "Checked", or "Problem" with a short
// note. Saved straight away, so a reviewer can stop and carry on later.
export function SectionTick({
  lessonId,
  version,
  section,
  tick,
  label,
  onChange,
}: {
  lessonId: string;
  version: number;
  section: number;
  tick: Tick | undefined;
  label: string;
  onChange: (tick: Tick | undefined) => void;
}) {
  const ids = useId();
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState(tick?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save(verdict: "checked" | "problem" | "clear") {
    setBusy(true);
    setMessage(undefined);
    const result = await tickSection({ lessonId, version, section, verdict, note });
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setWriting(false);
    onChange(verdict === "clear" ? undefined : { section, verdict, note: verdict === "problem" ? note.trim() : null });
  }

  if (tick && !writing) {
    return (
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-sm ${tick.verdict === "checked" ? "border-success" : "border-warning"}`}>
        <span className={tick.verdict === "checked" ? "text-success" : "text-warning"}>
          {tick.verdict === "checked" ? "✓ Checked" : `⚠ Problem: ${tick.note}`}
        </span>
        <button type="button" disabled={busy} onClick={() => void save("clear")} className="text-muted underline underline-offset-2">
          Undo
        </button>
        <FormAlert message={message} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void save("checked")} className={compactPrimaryButton}>
          ✓ Checked
        </button>
        {!writing && (
          <button type="button" disabled={busy} onClick={() => setWriting(true)} className={compactSecondaryButton}>
            Problem…
          </button>
        )}
        <span className="text-sm text-muted">{label}: matches the library?</span>
      </div>
      {writing && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${ids}-note`} className="text-sm font-medium">
            What is wrong?
          </label>
          <textarea
            id={`${ids}-note`}
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-[15px]"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || note.trim().length < 3} onClick={() => void save("problem")} className={compactSecondaryButton}>
              Mark as a problem
            </button>
            <button type="button" onClick={() => setWriting(false)} className="text-sm text-muted underline underline-offset-2">
              Cancel
            </button>
          </div>
        </div>
      )}
      <FormAlert message={message} />
    </div>
  );
}
