"use client";

import { useEffect, useId, useRef, useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/Icon";

// Check a typed web address: adds https:// when left out; only web links are allowed.
export function cleanLink(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return withScheme.length <= 500 ? withScheme : null;
  } catch {
    return null;
  }
}

// "Add link", as in Slack: the words to show and the web address. The words fill in from the
// selection.
export function LinkDialog({ initialText, onSave, onClose }: { initialText: string; onSave: (label: string, href: string) => void; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(initialText);
  const [href, setHref] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const words = label.trim().replace(/[[\]\n]/g, "");
    const link = cleanLink(href);
    if (!words) return setError("Type the words to show.");
    if (!link) return setError("Type a web address, for example https://mylawdeck.com.");
    onSave(words.slice(0, 200), link);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-32px))] rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={save} noValidate className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            Add link
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink">
            <Icon name="close" size={18} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Text
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} autoFocus={!initialText} className="h-11 rounded-lg border border-line bg-surface px-3 text-[16px] font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Link
          <input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            inputMode="url"
            placeholder="https://"
            maxLength={500}
            autoFocus={Boolean(initialText)}
            className="h-11 rounded-lg border border-line bg-surface px-3 text-[16px] font-normal"
          />
        </label>
        {error && (
          <p role="alert" className="text-[14px] text-warning">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className={compactSecondaryButton}>
            Cancel
          </button>
          <button type="submit" className={compactPrimaryButton}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
