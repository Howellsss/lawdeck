"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EmojiGroup } from "@/lib/emojiData";

const RECENT_KEY = "lawdeck-recent-emojis";

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, 24)));
  } catch {
    // Private windows may block storage; recent emojis are only a convenience.
  }
}

// The emoji panel, as in Slack: every standard emoji (loaded when the panel first opens), search by
// name, a tab per group, and the ones this browser used last. Picking one adds it where the cursor is.
export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [recent] = useState(readRecent);

  useEffect(() => {
    import("@/lib/emojiData").then((m) => setGroups(m.EMOJI_GROUPS), () => setFailed(true));
  }, []);

  useEffect(() => {
    panel.current?.querySelector("input")?.focus();
    const away = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("mousedown", away), document.removeEventListener("keydown", esc));
  }, [onClose]);

  const shown = useMemo(() => {
    if (!groups) return [];
    const q = query.trim().toLowerCase();
    if (q) return [{ name: "Results", emojis: groups.flatMap((g) => g.emojis).filter(([, name]) => name.toLowerCase().includes(q)).slice(0, 240) }];
    const byEmoji = new Map(groups.flatMap((g) => g.emojis).map((e) => [e[0], e] as const));
    const used = recent.flatMap((e) => (byEmoji.has(e) ? [byEmoji.get(e) as [string, string]] : []));
    return used.length ? [{ name: "Recently used", emojis: used }, ...groups] : groups;
  }, [groups, query, recent]);

  const pick = (emoji: string) => (saveRecent(emoji), onPick(emoji));
  const jump = (name: string) => grid.current?.querySelector(`[data-group="${name}"]`)?.scrollIntoView({ block: "start" });

  return (
    <div ref={panel} role="dialog" aria-label="Emojis" className="absolute bottom-full left-2 z-30 mb-1 flex w-[min(22rem,calc(100vw-48px))] flex-col rounded-xl border border-line bg-paper shadow-lg">
      <div className="p-2 pb-1">
        <label className="sr-only" htmlFor="emoji-search">
          Search emojis
        </label>
        <input
          id="emoji-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emojis"
          className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[15px] placeholder:text-muted"
        />
      </div>
      {groups && !query && (
        <div role="toolbar" aria-label="Emoji groups" className="flex gap-0.5 overflow-x-auto border-b border-line px-2 pb-1">
          {shown.map((g) => (
            <button
              key={g.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => jump(g.name)}
              aria-label={g.name}
              title={g.name}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-[17px] hover:bg-pill"
            >
              {g.name === "Recently used" ? "🕘" : g.emojis[0]?.[0]}
            </button>
          ))}
        </div>
      )}
      <div ref={grid} className="h-64 overflow-y-auto px-2 pb-2">
        {failed ? (
          <p role="alert" className="p-3 text-[14px] text-warning">
            Emojis could not load. Check your connection and try again.
          </p>
        ) : !groups ? (
          <p className="p-3 text-[14px] text-muted">Loading emojis…</p>
        ) : shown[0]?.emojis.length === 0 ? (
          <p className="p-3 text-[14px] text-muted">No emoji matches “{query}”.</p>
        ) : (
          shown.map((g) => (
            <section key={g.name} data-group={g.name} aria-label={g.name}>
              <h3 className="sticky top-0 bg-paper pb-1 pt-2 text-[12px] font-medium text-muted">{g.name}</h3>
              <div className="grid grid-cols-8 gap-0.5">
                {g.emojis.map(([emoji, name]) => (
                  <button
                    key={`${g.name}-${emoji}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(emoji)}
                    aria-label={name}
                    title={name}
                    className="flex aspect-square items-center justify-center rounded-md text-[20px] hover:bg-pill"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
