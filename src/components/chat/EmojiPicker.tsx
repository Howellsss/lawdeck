"use client";

import { useEffect, useRef } from "react";

// A small set of everyday emojis (no library): study, thanks, celebration and reactions.
export const EMOJIS = [
  ["😀", "grinning"], ["😂", "laughing"], ["🙂", "smile"], ["😊", "happy"], ["😉", "wink"], ["😍", "love it"],
  ["🤔", "thinking"], ["😅", "phew"], ["😢", "sad"], ["😮", "surprised"], ["😴", "sleepy"], ["🙄", "eye roll"],
  ["👍", "thumbs up"], ["👎", "thumbs down"], ["👏", "clapping"], ["🙏", "thank you"], ["🙌", "hooray"], ["💪", "strong"],
  ["👋", "hello"], ["🤝", "agreed"], ["👀", "looking"], ["✅", "done"], ["❌", "no"], ["❓", "question"],
  ["❤️", "heart"], ["🔥", "fire"], ["🎉", "celebrate"], ["⭐", "star"], ["💯", "100"], ["💡", "idea"],
  ["📚", "books"], ["📖", "reading"], ["📝", "notes"], ["✍️", "writing"], ["⚖️", "law"], ["🏛️", "court"],
  ["🎓", "graduate"], ["⏰", "deadline"], ["📌", "pin"], ["☕", "coffee"],
] as const;

// The emoji button's panel: a grid of emojis; picking one adds it where the cursor is.
export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector("button")?.focus();
    const away = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("mousedown", away), document.removeEventListener("keydown", esc));
  }, [onClose]);
  return (
    <div ref={panel} role="dialog" aria-label="Emojis" className="absolute bottom-full left-2 z-30 mb-1 w-[min(19rem,calc(100vw-48px))] rounded-xl border border-line bg-paper p-2 shadow-lg">
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map(([emoji, name]) => (
          <button
            key={emoji}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(emoji)}
            aria-label={name}
            title={name}
            className="flex size-8 items-center justify-center rounded-md text-[19px] hover:bg-pill"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
