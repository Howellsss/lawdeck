"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { formatWat } from "@/lib/dates";
import { DRAFTING_STATUS_LABELS } from "@/schemas/drafting";
import type { TemplateSummary } from "@/server/db/drafting";
import {
  approveTemplates,
  type BulkApproveResult,
} from "@/server/documents/actions";

// The document templates on Admin → Templates, with ticks to approve many at once
// (founder, 2026-10-25). The server runs the same checks as approving one by one.
export function TemplateList({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkApproveResult>();
  const waiting = templates.filter((t) => t.status !== "approved");
  const allPicked = waiting.length > 0 && waiting.every((t) => picked.has(t.id));
  const titles = new Map(templates.map((t) => [t.id, t.title]));

  function toggle(id: string) {
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approve() {
    setBusy(true);
    setResult(undefined);
    const outcome = await approveTemplates([...picked]);
    setBusy(false);
    setResult(outcome);
    if (outcome.ok) {
      setPicked(new Set(outcome.failed.map((f) => f.id)));
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-11 items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() =>
                setPicked(allPicked ? new Set() : new Set(waiting.map((t) => t.id)))
              }
              className="size-5 accent-ink"
            />
            Select all not yet approved ({waiting.length})
          </label>
          <button
            type="button"
            disabled={busy || picked.size === 0}
            onClick={() => void approve()}
            className={compactPrimaryButton}
          >
            {busy ? "Approving…" : `Approve selected (${picked.size})`}
          </button>
        </div>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-sm text-warning">
          {result.message}
        </p>
      )}
      {result?.ok && (
        <div
          role="status"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm"
        >
          <p className={result.failed.length === 0 ? "text-success" : ""}>
            {result.approved} approved
            {result.failed.length > 0
              ? ` · ${result.failed.length} not approved (still ticked; open each to fix)`
              : ""}
          </p>
          {result.failed.map((f) => (
            <div key={f.id} className="mt-2 text-warning">
              <p className="font-medium break-words">
                {titles.get(f.id) ?? "A template"}: {f.message}
              </p>
              {f.issues && f.issues.length > 0 && (
                <ul className="list-disc pl-5">
                  {f.issues.map((issue) => (
                    <li key={issue} className="break-words">
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <ul
        aria-label="Document templates"
        className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface"
      >
        {templates.map((template) => (
          <li key={template.id} className="flex items-start gap-3 px-4 py-3">
            {template.status !== "approved" ? (
              <input
                type="checkbox"
                aria-label={`Select ${template.title}`}
                checked={picked.has(template.id)}
                onChange={() => toggle(template.id)}
                className="mt-1 size-5 shrink-0 accent-ink"
              />
            ) : (
              <span aria-hidden className="size-5 shrink-0" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href={`/admin/templates/${template.id}`}
                className="break-words font-medium"
              >
                {template.title}
              </Link>
              <span className="text-sm text-muted">
                {template.courseName} · version {template.version} ·{" "}
                <span
                  className={template.status === "approved" ? "text-success" : ""}
                >
                  {DRAFTING_STATUS_LABELS[template.status]}
                </span>{" "}
                · updated {formatWat(template.updatedAt)}
              </span>
              {template.forumNames.length > 0 && (
                <span className="text-sm text-muted break-words">
                  For: {template.forumNames.join(", ")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
