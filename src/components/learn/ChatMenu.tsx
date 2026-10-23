"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ChatDeleteConfirm } from "./ChatDeleteConfirm";
import { ChatMoveForm, type ProjectOption } from "./ChatMoveForm";
import { ChatRenameForm } from "./ChatRenameForm";

export type ChatMenuChat = { id: string; title: string; projectId: string | null };
type Mode = "closed" | "options" | "rename" | "move" | "delete";

const optionClass = "block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-pill";

// The ⋯ button on a chat (in Recents and at the top of an open chat): rename, move to a
// project, or delete. Each choice opens a small form under the chat.
// `projects` is null when the student's projects could not be read.
export function ChatMenu({ chat, projects }: { chat: ChatMenuChat; projects: ProjectOption[] | null }) {
  const [mode, setMode] = useState<Mode>("closed");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const optionsId = useId();

  // The options list closes on Escape or a click elsewhere, and focus goes back to ⋯.
  useEffect(() => {
    if (mode !== "options") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMode("closed");
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setMode("closed");
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [mode]);

  function close() {
    setMode("closed");
    buttonRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Options for ${chat.title}`}
        aria-expanded={mode === "options"}
        aria-controls={mode === "options" ? optionsId : undefined}
        onClick={() => setMode(mode === "options" ? "closed" : "options")}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink"
      >
        <Icon name="more" size={18} />
      </button>

      {mode === "options" && (
        <ul
          id={optionsId}
          aria-label={`Options for ${chat.title}`}
          className="absolute right-0 top-full z-20 mt-1 flex w-48 flex-col gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          <li>
            <button type="button" autoFocus onClick={() => setMode("rename")} className={optionClass}>
              Rename
            </button>
          </li>
          <li>
            <button type="button" onClick={() => setMode("move")} className={optionClass}>
              Move to project
            </button>
          </li>
          <li>
            <button type="button" onClick={() => setMode("delete")} className={`${optionClass} text-warning`}>
              Delete
            </button>
          </li>
        </ul>
      )}

      {(mode === "rename" || mode === "move" || mode === "delete") && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-lg">
          {mode === "rename" && <ChatRenameForm chat={chat} onDone={close} />}
          {mode === "move" && <ChatMoveForm chat={chat} projects={projects} onDone={close} />}
          {mode === "delete" && <ChatDeleteConfirm chat={chat} onCancel={close} />}
        </div>
      )}
    </div>
  );
}
