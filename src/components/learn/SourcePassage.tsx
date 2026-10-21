"use client";

import { useEffect, useState } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { openSource, type OpenSourceResult } from "@/server/learn/actions";

// The wording of one source, shown in the right panel (PRD LN-03, WS-04).
export function SourcePassage({ id }: { id: string }) {
  const [result, setResult] = useState<OpenSourceResult | null>(null);

  useEffect(() => {
    let current = true;
    openSource(id)
      .then((value) => current && setResult(value))
      .catch(() => current && setResult({ ok: false, message: "That source could not be opened. Please try again." }));
    return () => {
      current = false;
    };
  }, [id]);

  if (!result) return <LoadingRows label="Opening the source" />;
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-warning">
        {result.message}
      </p>
    );
  }
  const { source } = result;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium">{source.itemTitle}</p>
        <p className="text-sm text-muted">{[source.heading, source.pages].filter(Boolean).join(" · ")}</p>
      </div>
      {source.available && source.text ? (
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{source.text}</p>
      ) : (
        <p className="rounded-2xl border border-warning px-4 py-3 text-sm text-warning">
          This material has been withdrawn or is being re-checked after a change in the law, so its wording is no longer
          shown. Ask the question again for an up-to-date answer.
        </p>
      )}
    </div>
  );
}
