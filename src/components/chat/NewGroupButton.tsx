"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/Icon";
import { createStudyGroup } from "@/server/chat/groups";

// "New study group": a name, then the group opens so the creator can invite people from Members.
export function NewGroupButton() {
  const id = useId();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await createStudyGroup({ name });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    dialog.current?.close();
    router.push(`/chat/${result.key}/members`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[15px] text-muted hover:bg-pill/60 hover:text-ink"
      >
        <Icon name="plus" size={15} />
        New study group
      </button>
      {open && (
        <dialog
          ref={dialog}
          aria-labelledby={`${id}-title`}
          onClose={() => (setOpen(false), setName(""), setError(undefined))}
          className="m-auto w-[min(28rem,calc(100vw-32px))] rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/50"
        >
          <form onSubmit={(e) => void create(e)} noValidate className="flex flex-col gap-4 p-5">
            <h2 id={`${id}-title`} className="text-xl font-semibold">
              New study group
            </h2>
            <p className="-mt-2 text-[14px] text-muted">A private group for you and up to 14 classmates. Only people you invite can see it.</p>
            <label className="flex flex-col gap-1.5 text-[15px] font-medium">
              Group name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                placeholder="For example, Civil Lit squad"
                className="h-11 rounded-lg border border-line bg-surface px-3 text-[16px] font-normal placeholder:text-muted"
              />
            </label>
            {error && (
              <p role="alert" className="text-[14px] text-warning">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => (dialog.current?.close(), setOpen(false))} className={compactSecondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={compactPrimaryButton}>
                {busy ? "Creating…" : "Create group"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
