"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { approveCourseExtras, approveCourseLessons } from "@/server/lessons/actions";

// Approve every lesson awaiting review in one course (founder's decision, 2026-11-05). Students
// see these lessons with a note that a reviewer has not read them in full yet.
export function ApproveCourseButton({
  courseId,
  courseName,
  waiting,
  target = "lesson",
}: {
  courseId: string;
  courseName: string;
  waiting: number;
  target?: "lesson" | "extras";
}) {
  const what = target === "lesson" ? "lesson" : "set of memory aids";
  const whats = target === "lesson" ? "lessons" : "sets of memory aids";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "success"; message: string } | null>(null);

  async function approve() {
    if (
      !window.confirm(
        `Approve all ${waiting} ${waiting === 1 ? what : whats} awaiting review in ${courseName}? Students will see them straight away, with a note that a reviewer has not read them in full yet and a way to report a mistake.`,
      )
    )
      return;
    setBusy(true);
    setNotice(null);
    const result = target === "lesson" ? await approveCourseLessons({ courseId }) : await approveCourseExtras({ courseId });
    setBusy(false);
    if (!result.ok) return setNotice({ tone: "warning", message: result.message });
    setNotice({ tone: "success", message: `${result.approved} ${result.approved === 1 ? what : whats} approved.` });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={compactSecondaryButton} disabled={busy || waiting === 0} onClick={() => void approve()}>
        {busy ? "Approving…" : target === "lesson" ? `Approve all ${waiting} awaiting review` : `Approve ${waiting} memory aid set${waiting === 1 ? "" : "s"}`}
      </button>
      <FormAlert message={notice?.message} tone={notice?.tone} />
    </div>
  );
}
