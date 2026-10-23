"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { LoadReport } from "@/server/documents/load";
import { loadTemplateFiles } from "@/server/documents/actions";

// Loads the template and court files from src/templates. New and changed files arrive as
// drafts; files that fail the checks are listed with what to fix.
export function LoadFilesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LoadReport>();
  const [error, setError] = useState<string>();

  async function load() {
    setBusy(true);
    setError(undefined);
    const result = await loadTemplateFiles();
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setReport(result.report);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
        className={`${compactPrimaryButton} self-start`}
      >
        {busy ? "Loading…" : "Load from files"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}
      {report && (
        <div
          role="status"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm"
        >
          <p>
            {report.added} added · {report.updated} updated (back to draft) ·{" "}
            {report.unchanged} unchanged
            {report.problems.length > 0
              ? ` · ${report.problems.length} with problems`
              : ""}
          </p>
          {report.problems.map((problem) => (
            <div key={problem.file} className="mt-2 text-warning">
              <p className="font-medium break-words">{problem.file}</p>
              <ul className="list-disc pl-5">
                {problem.issues.map((issue) => (
                  <li key={issue} className="break-words">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
