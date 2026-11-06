"use client";

import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { formatWat } from "@/lib/dates";
import { createInviteLink, turnOffInviteLink } from "@/server/chat/links";

// The creator's invite link (step 4g): anyone with it can sign up or log in and join, after the
// chat ID step. It works for 7 days; a new link stops the old one. Lawdeck keeps only a scrambled
// copy, so the link itself is shown once, when it is made.
export function InviteLinkBox({ groupId, linkUntil }: { groupId: string; linkUntil: string | null }) {
  const [until, setUntil] = useState(linkUntil);
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string }>();

  const make = async () => {
    if (until && !url && !window.confirm("Make a new link? The old link will stop working.")) return;
    setBusy(true);
    setNote(undefined);
    const result = await createInviteLink({ groupId });
    setBusy(false);
    if (!result.ok) return setNote({ ok: false, text: result.message });
    setUrl(result.url);
    setUntil(result.expiresAt);
    await copy(result.url);
  };
  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setNote({ ok: true, text: "Link copied. Send it to the people you want in this group." });
    } catch {
      setNote({ ok: true, text: "Copy the link below and send it." });
    }
  };
  const off = async () => {
    setBusy(true);
    const result = await turnOffInviteLink({ groupId });
    setBusy(false);
    if (!result.ok) return setNote({ ok: false, text: result.message });
    setUntil(null);
    setUrl(undefined);
    setNote({ ok: true, text: "The link is off. Nobody new can join with it." });
  };

  return (
    <section aria-labelledby="invite-link" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h2 id="invite-link" className="text-lg font-medium">
          Invite link
        </h2>
        <p className="text-[14px] text-muted">
          For classmates who aren&rsquo;t in chat yet: they sign up or log in, confirm they&rsquo;re a student, then join. Works for 7 days.
        </p>
      </div>
      {url && (
        <input readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-[14px]" />
      )}
      {until && !url && <p className="text-[14px]">A link is working until {formatWat(until)}. For security it can&rsquo;t be shown again: make a new one to copy it.</p>}
      <div className="flex flex-wrap gap-2">
        {url ? (
          <button type="button" onClick={() => void copy(url)} className={compactPrimaryButton}>
            Copy link
          </button>
        ) : (
          <button type="button" onClick={() => void make()} disabled={busy} className={compactPrimaryButton}>
            {busy ? "Making…" : until ? "Make a new link" : "Create invite link"}
          </button>
        )}
        {until && (
          <button type="button" onClick={() => void off()} disabled={busy} className={compactSecondaryButton}>
            Turn off link
          </button>
        )}
      </div>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`text-[14px] ${note.ok ? "text-muted" : "text-warning"}`}>
          {note.text}
        </p>
      )}
    </section>
  );
}
