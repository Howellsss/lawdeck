"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";

// Asks Lawdeck to write (or rewrite) a topic's lesson from the library, or (kind "extras") its
// memory aids and stories from the lesson. Takes a few minutes.
export function GenerateLessonButton({ topicId, hasLesson, kind = "lesson" }: { topicId: string; hasLesson: boolean; kind?: "lesson" | "extras" }) {
  const extras = kind === "extras";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "success"; message: string } | null>(null);

  async function generate() {
    const ask = extras
      ? "Rewrite the memory aids and stories? Their current versions are replaced and go back to review."
      : "Write a new version of this lesson, with its memory aids and stories? If it is approved, students keep reading the current version until you approve the new one; then their revision of this topic starts again.";
    if (hasLesson && !window.confirm(ask)) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(extras ? "/api/admin/lessons/extras" : "/api/admin/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      const result = (await response.json()) as
        | { ok: true; sections: number; checkpoints: number; authorities: number; aids?: number; stories?: number; removed: number }
        | { ok: false; message: string };
      if (!result.ok) {
        setNotice({ tone: "warning", message: result.message });
      } else if (extras) {
        const removed = result.removed ? ` ${result.removed} left out by Lawdeck's checks.` : "";
        setNotice({ tone: "success", message: `Written: ${result.aids ?? 0} memory aids and ${result.stories ?? 0} stories, awaiting your review.${removed}` });
        router.refresh();
      } else {
        const removed = result.removed ? ` ${result.removed} item${result.removed === 1 ? " was" : "s were"} left out because the library could not confirm ${result.removed === 1 ? "it" : "them"}.` : "";
        const written = `Written: ${result.sections} sections, ${result.checkpoints} questions and ${result.authorities} authorities, awaiting your review.${removed}`;
        setNotice({ tone: "success", message: `${written} Now writing its memory aids and stories…` });
        router.refresh();
        // Then the lesson's memory aids and stories, so one press does both.
        const aids = await fetch("/api/admin/lessons/extras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId }),
        })
          .then((r) => r.json() as Promise<{ ok: true; aids: number; stories: number } | { ok: false; message: string }>)
          .catch(() => ({ ok: false as const, message: "The connection was lost." }));
        setNotice(
          aids.ok
            ? { tone: "success", message: `${written} Memory aids: ${aids.aids}, stories: ${aids.stories}.` }
            : { tone: "warning", message: `${written} Its memory aids were not written: ${aids.message} Use “Write memory aids and stories” below.` },
        );
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
        {busy
          ? extras
            ? "Writing… (about 1–3 minutes)"
            : "Writing… (about 3–7 minutes with its memory aids)"
          : extras
            ? hasLesson
              ? "Rewrite the memory aids and stories"
              : "Write memory aids and stories"
            : hasLesson
              ? "Write a new version from the library"
              : "Write the lesson from the library"}
      </button>
      {busy && (
        <p role="status" className="text-sm text-muted">
          Lawdeck is {extras ? "writing memory aids and stories from the lesson" : "reading the library and writing the lesson, then its memory aids"}. Keep this page open.
        </p>
      )}
      <FormAlert message={notice?.message} tone={notice?.tone} />
    </div>
  );
}
