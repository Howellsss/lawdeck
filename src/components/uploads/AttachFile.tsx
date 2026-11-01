"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { LIBRARY_ACCEPT } from "@/lib/libraryFiles";
import { UploadNotice } from "./UploadNotice";
import { uploadAndRead } from "./uploadAndRead";

type State =
  | { kind: "idle" }
  | { kind: "working"; name: string; text: string }
  | { kind: "ready"; name: string }
  | { kind: "failed"; name: string; message: string }
  | { kind: "notice"; file: File };

// The + button in the question boxes (PRD WS-02): attach a PDF, Word file or photo. It goes into
// the student's private uploads (the same as My uploads), is read, and is then used in answers,
// labelled "From your uploads". Before a student's first upload, the upload notice is shown here.
export function AttachFile({
  onBusyChange,
  onReady,
  compact = false,
}: {
  // True while a file is uploading or being read, so the question waits for it.
  onBusyChange?: (busy: boolean) => void;
  onReady?: (fileName: string) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  // The publishable key (not secret) lets the browser send the file to its one-time upload link.
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  async function send(file: File) {
    onBusyChange?.(true);
    setState({ kind: "working", name: file.name, text: "Uploading… 0%" });
    const result = await uploadAndRead(file, apiKey, (text) => setState({ kind: "working", name: file.name, text }));
    onBusyChange?.(false);
    if (result.ok) {
      setState({ kind: "ready", name: file.name });
      onReady?.(file.name);
    } else if (result.needsNotice) setState({ kind: "notice", file });
    else setState({ kind: "failed", name: file.name, message: result.message });
  }

  const working = state.kind === "working";
  const size = compact ? "size-9 sm:size-10" : "size-11";

  return (
    <>
      <button
        type="button"
        aria-label="Attach a file"
        title="Attach a PDF, Word file or photo"
        disabled={working}
        onClick={() => input.current?.click()}
        className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-pill text-ink disabled:opacity-60`}
      >
        <Icon name="plus" size={17} />
      </button>
      <input
        ref={input}
        type="file"
        accept={LIBRARY_ACCEPT}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void send(file);
        }}
      />
      {state.kind !== "idle" && (
        <AttachStatus
          state={state}
          onDismiss={() => setState({ kind: "idle" })}
          onAccepted={() => state.kind === "notice" && void send(state.file)}
        />
      )}
    </>
  );
}

// The line under the question box saying what is happening to the attached file. It is placed
// out of the row of buttons by its own full-width layout (order and basis).
function AttachStatus({ state, onDismiss, onAccepted }: { state: Exclude<State, { kind: "idle" }>; onDismiss: () => void; onAccepted: () => void }) {
  if (state.kind === "notice")
    return (
      <div className="order-last basis-full pt-2">
        <UploadNotice onAccepted={onAccepted} />
      </div>
    );
  const name = state.name;
  return (
    <div className="order-last flex basis-full items-center gap-2 px-1 pt-2 text-sm" role={state.kind === "failed" ? "alert" : "status"}>
      <Icon name="document" size={16} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="font-medium break-all">{name}</span>
        {state.kind === "working" && <span className="text-muted"> · {state.text}</span>}
        {state.kind === "ready" && <span className="text-success"> · Ready. Ask your question and Lawdeck will use it.</span>}
        {state.kind === "failed" && (
          <span className="text-warning">
            {" "}
            · {state.message} <Link href="/uploads">My uploads</Link>
          </span>
        )}
      </span>
      {state.kind !== "working" && (
        <button type="button" onClick={onDismiss} aria-label="Hide this message" className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-pill">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
