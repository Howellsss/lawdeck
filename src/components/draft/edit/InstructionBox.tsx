"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { Spinner } from "@/components/ui/Spinner";
import { INSTRUCTION_MAX_CHARS } from "@/schemas/drafting";
import { changeByInstruction } from "@/server/drafting/editActions";
import type { FactRequest } from "./FactsEditor";

// A change by instruction (DR-05), e.g. "add a second defendant". Lawdeck rewrites the narrative
// parts and asks for any new fact rather than inventing it.
export function InstructionBox({ documentId, onAskFor }: { documentId: string; onAskFor: (requests: FactRequest[]) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean }>();

  async function submit(form: FormData) {
    const instruction = String(form.get("instruction") ?? "");
    setBusy(true);
    setNote(undefined);
    const result = await changeByInstruction({ documentId, instruction });
    setBusy(false);
    if (!result.ok) return setNote({ text: result.message, ok: false });
    const asks = result.askFor.length ? ` Please add: ${result.askFor.map((a) => a.label).join(", ")} (in Facts below).` : "";
    setNote({ text: `${result.note}${asks}`, ok: true });
    if (result.askFor.length) onAskFor(result.askFor.map(({ field, addAnother }) => ({ field, addAnother })));
    if (result.changed) router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <label htmlFor="instruction" className="font-medium">
        Change it by instruction
      </label>
      <textarea
        id="instruction"
        name="instruction"
        rows={2}
        required
        minLength={3}
        maxLength={INSTRUCTION_MAX_CHARS}
        placeholder="For example: add a second defendant, or make the facts shorter"
        aria-describedby="instruction-hint"
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink"
      />
      <p id="instruction-hint" className="text-sm text-muted">
        Don’t type names or addresses here: add them in Facts. Each change by instruction counts as one of your questions this month.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? (
            <span className="flex items-center gap-2">
              <Spinner />
              {"Changing…"}
            </span>
          ) : "Make the change"}
        </button>
        {note && (
          <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "text-muted" : "text-warning"}`}>
            {note.text}
          </p>
        )}
      </div>
    </form>
  );
}
