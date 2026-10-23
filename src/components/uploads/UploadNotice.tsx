"use client";

import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { acceptUploadNotice } from "@/server/uploads/actions";

// Shown before a student's first upload and accepted once (PRD UP-06, Appendix C).
export function UploadNotice() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function accept() {
    setBusy(true);
    setMessage(undefined);
    const result = await acceptUploadNotice();
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <section aria-labelledby="upload-notice" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h2 id="upload-notice" className="font-serif text-2xl font-normal">
        Before you upload
      </h2>
      <p>Upload material you use for your own study, such as your notes, handouts and past answers.</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>Your files stay private to you. Other students cannot see them.</li>
        <li>Lawdeck uses them only to answer your questions and build your practice material, and never adds them to its library.</li>
        <li>You can delete them at any time.</li>
      </ul>
      <p>Please do not upload other people’s personal information or anything you have been told to keep confidential.</p>
      <button type="button" disabled={busy} onClick={() => void accept()} className={`${compactPrimaryButton} self-start`}>
        {busy ? "Saving…" : "I understand"}
      </button>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </section>
  );
}
