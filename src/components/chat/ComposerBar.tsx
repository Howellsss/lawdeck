"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CHAT_FILE_ACCEPT } from "@/lib/chatFiles";
import { EmojiPicker } from "./EmojiPicker";

const tool = "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink disabled:opacity-40";

// The row under the message box, as in Slack: + to attach a file, Aa to show or hide formatting,
// an emoji, @ to mention someone, a book to share a lesson, a microphone for voice notes (study groups only), and Send.
export function ComposerBar({
  busy,
  canSend,
  formatting,
  onFiles,
  onToggleFormatting,
  onInsert,
  onMention,
  onVoice,
  onShareLesson,
  onSend,
}: {
  busy: boolean;
  canSend: boolean;
  formatting: boolean;
  onFiles: (files: FileList | null) => void;
  onToggleFormatting: () => void;
  onInsert: (text: string) => void;
  onMention: () => void;
  onVoice?: () => void;
  onShareLesson?: () => void;
  onSend: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [emoji, setEmoji] = useState(false);
  return (
    <div className="relative flex items-center gap-0.5 px-2 pb-2">
      <input
        ref={picker}
        type="file"
        multiple
        accept={CHAT_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))}
      />
      <button type="button" onClick={() => picker.current?.click()} disabled={busy} aria-label="Attach a file (PDF, Word or image, up to 25 MB)" title="Attach a file" className={`${tool} rounded-full bg-pill text-ink`}>
        <Icon name="plus" size={18} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleFormatting}
        aria-pressed={formatting}
        aria-label={formatting ? "Hide formatting" : "Show formatting"}
        title={formatting ? "Hide formatting" : "Show formatting"}
        className={`${tool} text-[15px] font-medium underline underline-offset-4`}
      >
        Aa
      </button>
      <div>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setEmoji((v) => !v)} aria-expanded={emoji} aria-label="Add an emoji" title="Emoji" className={tool}>
          <Icon name="smile" size={19} />
        </button>
        {emoji && <EmojiPicker onPick={(e) => (onInsert(e), setEmoji(false))} onClose={() => setEmoji(false)} />}
      </div>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onMention} aria-label="Mention someone" title="Mention someone" className={`${tool} text-[18px]`}>
        @
      </button>
      {onShareLesson && (
        <button type="button" onClick={onShareLesson} disabled={busy} aria-label="Share a lesson" title="Share a lesson" className={tool}>
          <Icon name="book" size={18} />
        </button>
      )}
      {onVoice && (
        <button type="button" onClick={onVoice} disabled={busy} aria-label="Record a voice note" title="Record a voice note (up to 2 minutes)" className={tool}>
          <Icon name="mic" size={18} />
        </button>
      )}
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send message"
        className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-on-ink disabled:bg-pill disabled:text-muted"
      >
        <Icon name="send" size={18} />
      </button>
    </div>
  );
}
