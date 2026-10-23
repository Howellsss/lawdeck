"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatWat } from "@/lib/dates";
import type { VersionSummary } from "@/server/db/documents";
import type { DocModel } from "@/server/documents/render";
import { makeVersionCurrent, showVersion } from "@/server/drafting/editActions";

// Every saved change is a version (DR-05). Look at an earlier one, or make it current again;
// nothing is ever deleted.
export function VersionList({
  documentId,
  versions,
  onShow,
}: {
  documentId: string;
  versions: VersionSummary[];
  onShow: (model: DocModel, number: number) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function look(versionId: string) {
    setBusy(versionId);
    setMessage(undefined);
    const result = await showVersion({ documentId, versionId });
    setBusy(undefined);
    if (!result.ok) return setMessage(result.message);
    onShow(result.model, result.number);
  }

  async function restore(versionId: string) {
    setBusy(versionId);
    setMessage(undefined);
    const result = await makeVersionCurrent({ documentId, versionId });
    setBusy(undefined);
    if (!result.ok) return setMessage(result.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Versions" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        {versions.map((version) => (
          <li key={version.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <span className="font-medium">Version {version.number}</span>
            <span className="text-muted">
              {version.by === "ai" ? "Lawdeck" : "You"} · {formatWat(version.createdAt)}
            </span>
            {version.current ? (
              <span className="ml-auto rounded-full border border-line px-3 py-1 text-muted">Current</span>
            ) : (
              <span className="ml-auto flex gap-3">
                <button type="button" disabled={busy !== undefined} onClick={() => void look(version.id)} className="underline underline-offset-2">
                  Look
                </button>
                <button type="button" disabled={busy !== undefined} onClick={() => void restore(version.id)} className="underline underline-offset-2">
                  {busy === version.id ? "Restoring…" : "Restore"}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
