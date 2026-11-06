"use client";

import { useActionState, useId } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { saveCampus, type CampusState } from "@/server/account/campusActions";

type Campus = { key: string; name: string; kind: "campus" | "aspirant" };

// "Your campus" (campus chat, Phase 1): a Law School campus, or "Law School aspirant" for students
// not yet at Law School. Used on the home page the first time and on the Account page after that.
export function CampusForm({ campuses, campus, compact = false }: { campuses: Campus[]; campus: string | null; compact?: boolean }) {
  const id = useId();
  const [state, action, pending] = useActionState(saveCampus, { status: "idle", campus: campus ?? "" } as CampusState);
  const sites = campuses.filter((c) => c.kind === "campus");
  const aspirant = campuses.filter((c) => c.kind === "aspirant");
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor={`${id}-campus`} className="text-sm font-medium">
        {compact ? "Which Law School campus are you on?" : "Your campus"}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={`${id}-campus`}
          name="campus"
          defaultValue={state.campus ?? ""}
          aria-describedby={`${id}-note`}
          aria-invalid={state.status === "error"}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[16px] sm:max-w-xs"
        >
          <option value="" disabled={compact}>
            {compact ? "Choose your campus" : "Not chosen"}
          </option>
          <optgroup label="Law School campuses">
            {sites.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </optgroup>
          {aspirant.length > 0 && (
            <optgroup label="Not yet at Law School">
              {aspirant.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button type="submit" disabled={pending} className={compactPrimaryButton}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p id={`${id}-note`} className="text-sm text-muted">
        In final year at university? Choose &ldquo;Law School aspirant&rdquo;. Your campus shows beside your name in campus chat; change it here at any time.
      </p>
      {state.status === "saved" && (
        <p role="status" className="text-sm text-success">
          Saved.
        </p>
      )}
      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-warning">
          {state.message}
        </p>
      )}
    </form>
  );
}
