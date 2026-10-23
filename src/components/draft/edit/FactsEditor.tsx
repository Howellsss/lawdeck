"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { TemplateField } from "@/schemas/drafting";
import { changeFacts } from "@/server/drafting/editActions";
import { IntakeField } from "../IntakeField";

export type FactRequest = { field: string; addAnother: boolean };

// The document's facts (intake answers), changed by hand (DR-05). Saving adds a new version; no AI.
export function FactsEditor({
  documentId,
  fields,
  facts,
  requests,
}: {
  documentId: string;
  fields: TemplateField[];
  facts: Record<string, string[]>;
  // Facts Lawdeck asked for after an instruction (e.g. a second defendant's name).
  requests: FactRequest[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();

  async function submit(form: FormData) {
    setBusy(true);
    setMessage(undefined);
    const answers: Record<string, string[]> = {};
    for (const field of fields) answers[field.id] = form.getAll(field.id).map(String);
    const result = await changeFacts({ documentId, facts: answers });
    setBusy(false);
    if (!result.ok) return setMessage({ text: result.message, ok: false });
    setMessage({ text: result.changed ? "Saved as a new version." : "Nothing had changed.", ok: true });
    if (result.changed) router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-6">
      {fields.map((field) => {
        const request = requests.find((r) => r.field === field.id);
        return (
          <IntakeField
            key={field.id}
            field={field}
            values={facts[field.id] ?? []}
            extra={request?.addAnother ? 1 : 0}
            note={request ? "Lawdeck needs this for your last change." : undefined}
          />
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? "Saving…" : "Save facts"}
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-muted" : "text-warning"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
