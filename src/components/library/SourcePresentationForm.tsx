"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { SOURCE_KIND_LABELS, SOURCE_RIGHTS_LABELS } from "@/lib/libraryLabels";
import type { SourcePresentation } from "@/server/db/sourcePresentation";
import { saveSourcePresentation } from "@/server/library/presentationActions";
import { SelectField } from "./SelectField";

// Staff: how students see this item, and whether Lawdeck may use it (migration 37). The
// original title, file name and Drive link above never change.
export function SourcePresentationForm({ id, initial }: { id: string; initial: SourcePresentation }) {
  const [displayTitle, setDisplayTitle] = useState(initial.displayTitle ?? "");
  const [displayTopic, setDisplayTopic] = useState(initial.displayTopic ?? "");
  const [rightsNote, setRightsNote] = useState(initial.rightsNote ?? "");
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () =>
          setResult(
            await saveSourcePresentation({
              id,
              kind: String(form.get("kind") ?? ""),
              displayTitle,
              displayTopic,
              rightsStatus: String(form.get("rights") ?? ""),
              rightsNote,
            }),
          ),
        );
      }}
    >
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <SelectField label="What it is" name="kind" defaultValue={initial.kind} options={Object.entries(SOURCE_KIND_LABELS)} />
      <TextField
        label="Title students see (official documents and publications)"
        hint="Leave empty to use the item's own title. Never a lecturer's name or an invented title."
        value={displayTitle}
        onChange={(event) => setDisplayTitle(event.target.value)}
        maxLength={300}
      />
      <TextField
        label="Topic students see (notes and unidentified material)"
        hint="Shown as “Course — Topic”. Leave empty to use each passage's heading."
        value={displayTopic}
        onChange={(event) => setDisplayTopic(event.target.value)}
        maxLength={160}
      />
      <SelectField label="Permission to use" name="rights" defaultValue={initial.rightsStatus} options={Object.entries(SOURCE_RIGHTS_LABELS)} />
      <TextAreaField
        label="Permission note"
        hint="Who gave permission, or why it is uncertain or restricted."
        rows={2}
        value={rightsNote}
        onChange={(event) => setRightsNote(event.target.value)}
        maxLength={2000}
      />
      <button type="submit" disabled={pending} className={`${compactPrimaryButton} self-start`}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
