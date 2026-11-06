"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { approveCourseExtras } from "@/server/lessons/actions";

// Approve every set of memory aids and stories awaiting review in one course (founder's decision,
// 2026-11-05). Lessons are not approved this way any more (2026-11-06): each is read in full.
export function ApproveCourseButton({ courseId, courseName, waiting }: { courseId: string; courseName: string; waiting: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "success"; message: string } | null>(null);

  async function approve() {
    if (
      !window.confirm(
        `Approve all ${waiting} ${waiting === 1 ? "set" : "sets"} of memory aids awaiting review in ${courseName}? Students see each set once its lesson is approved too.`,
      )
    )
      return;
    setBusy(true);
    setNotice(null);
    const result = await approveCourseExtras({ courseId });
    setBusy(false);
    if (!result.ok) return setNotice({ tone: "warning", message: result.message });
    setNotice({ tone: "success", message: `${result.approved} ${result.approved === 1 ? "set" : "sets"} of memory aids approved.` });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={compactSecondaryButton} disabled={busy || waiting === 0} onClick={() => void approve()}>
        {busy ? "Approving…" : `Approve ${waiting} memory aid set${waiting === 1 ? "" : "s"}`}
      </button>
      <FormAlert message={notice?.message} tone={notice?.tone} />
    </div>
  );
}
