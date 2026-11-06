"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChatPerson } from "@/server/chat/data";
import { findPeople } from "@/server/chat/actions";
import { linkLabels } from "@/lib/chatFormat";
import { AttachmentChips } from "./AttachmentChips";
import { ComposerBar } from "./ComposerBar";
import { LinkNote, MentionList } from "./ComposerParts";
import { applyFormat, FormatBar, type Format } from "./FormatBar";
import { LinkDialog } from "./LinkDialog";
import { VoiceRecorder } from "./VoiceRecorder";
import { useAttachments, type Attached } from "./useAttachments";

export type { Attached };

// The message box (Slack-style): formatting row (Aa hides it), the text, @mention suggestions, files,
// emojis, Enter to send and Shift+Enter for a new line. A link shows only its words while typing and
// becomes a link when sent; names picked from the suggestions become mentions on the server.
export function ChatComposer({
  groupId,
  groupName,
  apiKey,
  voiceNotes = false,
  onShareLesson,
  onSend,
  error,
}: {
  groupId: string;
  groupName: string;
  apiKey: string;
  voiceNotes?: boolean;
  onShareLesson?: () => void;
  onSend: (text: string, picked: ChatPerson[], files: Attached[]) => Promise<boolean>;
  error?: string;
}) {
  const id = useId();
  const attach = useAttachments(groupId, apiKey);
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<ChatPerson[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [active, setActive] = useState(0);
  const [formatting, setFormatting] = useState(true);
  const [links, setLinks] = useState<{ label: string; href: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const [linkBox, setLinkBox] = useState<{ text: string; start: number; end: number } | null>(null);

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

  // Puts text where the cursor is (an emoji, or @ to start a mention).
  const insert = (value: string, mention = false) => {
    const el = box.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const lead = mention && start > 0 && !/\s/.test(text[start - 1]) ? " " : "";
    const next = text.slice(0, start) + lead + value + text.slice(end);
    const at = start + lead.length + value.length;
    setText(next);
    requestAnimationFrame(() => (el?.focus(), el?.setSelectionRange(at, at)));
  };

  const addLink = (label: string, href: string) => {
    const place = linkBox ?? { start: text.length, end: text.length };
    const next = text.slice(0, place.start) + label + text.slice(place.end);
    setText(next);
    setLinks((list) => [...list.filter((l) => l.label !== label), { label, href }]);
    setLinkBox(null);
    const at = place.start + label.length;
    requestAnimationFrame(() => (box.current?.focus(), box.current?.setSelectionRange(at, at)));
  };

  const format = (f: Format) => {
    const el = box.current;
    if (!el) return;
    if (f === "link") return setLinkBox({ text: text.slice(el.selectionStart, el.selectionEnd), start: el.selectionStart, end: el.selectionEnd });
    const result = applyFormat(text, el.selectionStart, el.selectionEnd, f);
    setText(result.text);
    requestAnimationFrame(() => (el.focus(), el.setSelectionRange(result.start, result.end)));
  };

  const send = async () => {
    if ((!text.trim() && attach.ready.length === 0) || busy || attach.uploading) return;
    setBusy(true);
    const body = linkLabels(text, links.filter((l) => text.includes(l.label)));
    const sent = await onSend(body, picked.filter((p) => text.includes(`@${p.name}`)), attach.ready);
    setBusy(false);
    if (sent) {
      setText("");
      setPicked([]);
      setLinks([]);
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
    if (mod && ["b", "i", "u", "k"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      format(({ b: "bold", i: "italic", u: "underline", k: "link" } as const)[e.key.toLowerCase() as "b" | "i" | "u" | "k"]);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="relative px-4 pb-4 lg:px-6">
      {people.length > 0 && query && <MentionList people={people} active={active} onPick={pick} />}
      <div className="rounded-xl border border-line bg-surface focus-within:border-muted">
        {formatting && <FormatBar onFormat={format} disabled={busy} />}
        <AttachmentChips files={attach.files} onRemove={attach.remove} />
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
          className="block min-h-[40px] w-full resize-none bg-transparent px-3 py-2 text-[16px] leading-[1.5] outline-none placeholder:text-muted lg:text-[15px]"
        />
        <LinkNote links={links.filter((l) => text.includes(l.label))} />
        {recording && <VoiceRecorder groupId={groupId} apiKey={apiKey} onSend={(voice) => onSend("", [], [voice])} onClose={() => setRecording(false)} />}
        <ComposerBar
          busy={busy}
          canSend={!busy && !attach.uploading && (Boolean(text.trim()) || attach.ready.length > 0)}
          formatting={formatting}
          onFiles={(files) => void attach.add(files)}
          onToggleFormatting={() => setFormatting((v) => !v)}
          onInsert={(v) => insert(v)}
          onMention={() => {
            insert("@", true);
            setQuery(null);
          }}
          onVoice={voiceNotes && !recording ? () => setRecording(true) : undefined}
          onShareLesson={onShareLesson}
          onSend={() => void send()}
        />
      </div>
      {linkBox && <LinkDialog initialText={linkBox.text} onSave={addLink} onClose={() => setLinkBox(null)} />}
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
