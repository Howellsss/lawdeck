"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";

// Asks Lawdeck to write (or rewrite) a topic's lesson from the library. Takes a few minutes.
export function GenerateLessonButton({ topicId, hasLesson }: { topicId: string; hasLesson: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "success"; message: string } | null>(null);

  async function generate() {
    if (hasLesson && !window.confirm("Rewrite this lesson? Its questions are replaced, and students' revision for this topic starts again.")) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      const result = (await response.json()) as
        | { ok: true; sections: number; checkpoints: number; authorities: number; removed: number }
        | { ok: false; message: string };
      if (!result.ok) {
        setNotice({ tone: "warning", message: result.message });
      } else {
        const removed = result.removed ? ` ${result.removed} item${result.removed === 1 ? " was" : "s were"} left out because the library could not confirm ${result.removed === 1 ? "it" : "them"}.` : "";
        setNotice({
          tone: "success",
          message: `Written: ${result.sections} sections, ${result.checkpoints} questions and ${result.authorities} authorities, awaiting your review.${removed}`,
        });
        router.refresh();
      }
    } catch {
      setNotice({ tone: "warning", message: "The connection was lost. The lesson may still be saving: reload the page in a minute." });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button type="button" onClick={() => void generate()} disabled={busy} className={hasLesson ? compactSecondaryButton : compactPrimaryButton}>
        {busy ? "Writing… (about 2–4 minutes)" : hasLesson ? "Rewrite from the library" : "Write the lesson from the library"}
      </button>
      {busy && (
        <p role="status" className="text-sm text-muted">
          Lawdeck is reading the library and writing the lesson. Keep this page open.
        </p>
      )}
      <FormAlert message={notice?.message} tone={notice?.tone} />
    </div>
  );
}
