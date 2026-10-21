"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { COURSES } from "@/lib/courses";
import { openNewChat } from "./openNewChat";

const MODES = ["Auto", "Learn", "Draft"] as const;
type Mode = (typeof MODES)[number];

const SHORTCUTS: { label: string; icon: IconName; mode: Mode; starter: string }[] = [
  { label: "Learn", icon: "book", mode: "Learn", starter: "" },
  { label: "Draft", icon: "pen", mode: "Draft", starter: "Draft a " },
  { label: "Practice", icon: "check", mode: "Learn", starter: "Quiz me on " },
  { label: "Brief a case", icon: "scale", mode: "Learn", starter: "Brief the case of " },
];

const selectClass =
  "h-11 appearance-none rounded-full border-0 bg-pill pl-4 pr-9 text-[15px] text-ink outline-offset-2 cursor-pointer";

// The input-first composer (PRD 4.3). A Learn question starts a chat and opens it; the chat
// page asks the question and streams the answer. Drafting arrives in Phase 5.
export function Composer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("Auto");
  const [course, setCourse] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [routedToDraft, setRoutedToDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event: FormEvent, asMode: Mode = mode) {
    event.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    setRoutedToDraft(false);
    if (asMode === "Draft") return setNotice("Drafting documents arrives in a later build (Phase 5). Use Learn or Auto to ask a question.");
    setBusy(true);
    setNotice(null);
    const problem = await openNewChat(router, { question, course, mode: asMode === "Auto" ? "auto" : "learn" });
    if (!problem) return;
    setBusy(false);
    setNeedsSignIn(Boolean(problem.signIn));
    setRoutedToDraft(Boolean(problem.routedToDraft));
    setNotice(problem.message);
  }

  function applyShortcut(shortcut: (typeof SHORTCUTS)[number]) {
    setMode(shortcut.mode);
    if (shortcut.starter && !text) setText(shortcut.starter);
    inputRef.current?.focus();
  }

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-4">
      <form
        onSubmit={(event) => void submit(event)}
        // The box outlines itself while the student types (visible keyboard focus, WCAG 2.4.7).
        className="flex flex-col gap-3 rounded-3xl border border-line bg-surface px-3 pb-3 pt-4 shadow-[0_8px_28px_rgba(0,0,0,0.12)] has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-ink"
      >
        <label htmlFor="composer" className="sr-only">
          What are we working on?
        </label>
        <textarea
          id="composer"
          ref={inputRef}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) void submit(event);
          }}
          placeholder="What are we working on?"
          className="resize-none bg-transparent px-2 text-[17px] leading-relaxed text-ink outline-none placeholder:text-muted"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Attach a file"
            onClick={() => setNotice("Uploading your own files arrives in a later build (Phase 6).")}
            className="flex size-11 items-center justify-center rounded-full bg-pill text-ink"
          >
            <Icon name="plus" size={18} />
          </button>
          <Picker label="Mode" value={mode} onChange={(value) => setMode(value as Mode)} options={MODES.map((m) => [m, m])} />
          <Picker
            label="Course"
            value={course}
            onChange={setCourse}
            options={[["all", "All courses"], ...COURSES.map((c): [string, string] => [c.slug, c.name])]}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || busy}
            className="ml-auto flex size-11 items-center justify-center rounded-full bg-ink text-on-ink disabled:bg-pill disabled:text-muted"
          >
            <Icon name="arrowUp" size={18} />
          </button>
        </div>
      </form>

      {notice && (
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          {notice}
          {needsSignIn && (
            <>
              {" "}
              <Link href="/sign-in" className="text-ink underline underline-offset-2">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}
      {routedToDraft && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-line px-3 py-1 text-muted">Treated as: Draft</span>
          <button
            type="button"
            onClick={(event) => void submit(event, "Learn")}
            className="text-ink underline underline-offset-2"
          >
            Treat as Learn instead
          </button>
        </div>
      )}

      <div className="hidden flex-wrap justify-center gap-2 lg:flex">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => applyShortcut(shortcut)}
            className="flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-[15px] text-ink hover:bg-pill"
          >
            <Icon name={shortcut.icon} size={18} />
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Picker(props: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  const id = `picker-${props.label.toLowerCase()}`;
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {props.label}
      </label>
      <select id={id} value={props.value} onChange={(event) => props.onChange(event.target.value)} className={selectClass}>
        {props.options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}
