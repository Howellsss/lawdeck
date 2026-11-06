"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ChatPerson } from "@/server/chat/data";
import { findPeople } from "@/server/chat/actions";
import { CHAT_FILE_ACCEPT } from "@/lib/chatFiles";
import { AttachmentChips } from "./AttachmentChips";
import { applyFormat, FormatBar, type Format } from "./FormatBar";
import { useAttachments, type Attached } from "./useAttachments";

export type { Attached };

// The message box (Slack-style): formatting row, the text, @mention suggestions, Enter to send and
// Shift+Enter for a new line. The text is sent as typed; names picked from the suggestions become
// mentions on the server.
export function ChatComposer({
  groupId,
  groupName,
  apiKey,
  onSend,
  error,
}: {
  groupId: string;
  groupName: string;
  apiKey: string;
  onSend: (text: string, picked: ChatPerson[], files: Attached[]) => Promise<boolean>;
  error?: string;
}) {
  const id = useId();
  const attach = useAttachments(groupId, apiKey);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<ChatPerson[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [active, setActive] = useState(0);

  // Grow with the text, up to about eight lines.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  useEffect(() => {
    if (!query) return;
    const timer = window.setTimeout(() => void findPeople({ q: query }).then((found) => (setPeople(found), setActive(0))), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const readMention = (value: string, caret: number) => {
    const m = /(?:^|\s)@([\p{L}\p{N}'.-]{1,30})$/u.exec(value.slice(0, caret));
    setQuery(m ? m[1] : null);
    if (!m) setPeople([]);
  };

  const pick = (person: ChatPerson) => {
    const el = box.current;
    if (!el || !query) return;
    const caret = el.selectionStart;
    const before = text.slice(0, caret - query.length - 1);
    const next = `${before}@${person.name} ${text.slice(caret)}`;
    setText(next);
    setPicked((list) => (list.some((p) => p.id === person.id) ? list : [...list, person]));
    setQuery(null);
    setPeople([]);
    requestAnimationFrame(() => {
      const at = before.length + person.name.length + 2;
      el.focus();
      el.setSelectionRange(at, at);
    });
  };

  const format = (f: Format) => {
    const el = box.current;
    if (!el) return;
    const result = applyFormat(text, el.selectionStart, el.selectionEnd, f);
    setText(result.text);
    requestAnimationFrame(() => (el.focus(), el.setSelectionRange(result.start, result.end)));
  };

  const send = async () => {
    if ((!text.trim() && attach.ready.length === 0) || busy || attach.uploading) return;
    setBusy(true);
    const sent = await onSend(text, picked.filter((p) => text.includes(`@${p.name}`)), attach.ready);
    setBusy(false);
    if (sent) {
      setText("");
      setPicked([]);
      attach.clear();
    }
    box.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (people.length > 0 && query) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a + (e.key === "ArrowDown" ? 1 : people.length - 1)) % people.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(people[active]);
        return;
      }
      if (e.key === "Escape") return void (setQuery(null), setPeople([]));
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && ["b", "i", "k"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      format(({ b: "bold", i: "italic", k: "link" } as const)[e.key.toLowerCase() as "b" | "i" | "k"]);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="relative px-4 pb-4 lg:px-6">
      {people.length > 0 && query && (
        <ul role="listbox" aria-label="People to mention" className="absolute bottom-full left-4 z-20 mb-1 w-72 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lg lg:left-6">
          {people.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[14px] ${i === active ? "bg-pill" : ""}`}
              >
                <span className="font-medium">{p.name}</span>
                {p.campus && <span className="text-[12px] text-muted">{p.campus}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-xl border border-line bg-surface focus-within:border-muted">
        <FormatBar onFormat={format} disabled={busy} />
        <AttachmentChips files={attach.files} onRemove={attach.remove} />
        <div className="flex items-end gap-2 px-3 pb-2">
          <input
            ref={picker}
            type="file"
            multiple
            accept={CHAT_FILE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => (void attach.add(e.target.files), (e.target.value = ""))}
          />
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy}
            aria-label="Attach a file (PDF, Word or image, up to 25 MB)"
            title="Attach a file"
            className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink"
          >
            <Icon name="paperclip" size={18} />
          </button>
          <label htmlFor={`${id}-box`} className="sr-only">
            Message {groupName}
          </label>
          <textarea
            id={`${id}-box`}
            ref={box}
            rows={1}
            value={text}
            maxLength={4000}
            placeholder={`Message ${groupName}`}
            onChange={(e) => (setText(e.target.value), readMention(e.target.value, e.target.selectionStart))}
            onKeyDown={onKeyDown}
            className="min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[16px] leading-[1.5] outline-none placeholder:text-muted lg:text-[15px]"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || attach.uploading || (!text.trim() && attach.ready.length === 0)}
            aria-label="Send message"
            className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-on-ink disabled:bg-pill disabled:text-muted"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
      <div className="flex min-h-5 items-start justify-between gap-3 pt-1 text-[12px] text-muted">
        {error || attach.problem ? (
          <p role="alert" className="text-warning">
            {attach.problem ?? error}
          </p>
        ) : (
          <p className="hidden sm:block">
            <strong className="font-medium">Enter</strong> to send · <strong className="font-medium">Shift + Enter</strong> for a new line · @ to mention · # for a topic
          </p>
        )}
      </div>
    </div>
  );
}
