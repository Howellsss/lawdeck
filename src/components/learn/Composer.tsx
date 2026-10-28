"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { COURSES } from "@/lib/courses";
import { openDraft } from "@/server/drafting/actions";
import { VoiceButton } from "./VoiceButton";
import { openNewChat } from "./openNewChat";

const MODES = ["Auto", "Learn", "Draft"] as const;
type Mode = (typeof MODES)[number];

const SHORTCUTS: {
  label: string;
  icon: IconName;
  mode: Mode;
  starter: string;
}[] = [
  { label: "Learn", icon: "book", mode: "Learn", starter: "" },
  { label: "Draft", icon: "pen", mode: "Draft", starter: "Draft a " },
  { label: "Practice", icon: "check", mode: "Learn", starter: "Quiz me on " },
  {
    label: "Brief a case",
    icon: "scale",
    mode: "Learn",
    starter: "Brief the case of ",
  },
];

const selectClass =
  "h-9 w-full min-w-0 truncate appearance-none rounded-full border-0 bg-pill pl-3 pr-7 text-[14px] text-ink outline-offset-2 cursor-pointer sm:h-10 sm:text-[15px]";

// The input-first composer (PRD 4.3). A Learn question starts a chat and opens it; the chat
// page asks the question and streams the answer. A drafting request (Draft mode, or Auto mode
// routed to Draft) opens the matching reviewed document's questions, or the catalogue.
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
    setBusy(true);
    setNotice(null);
    if (asMode === "Draft") return goDraft(question);
    const problem = await openNewChat(router, {
      question,
      course,
      mode: asMode === "Auto" ? "auto" : "learn",
    });
    if (!problem) return;
    if (problem.routedToDraft) {
      setRoutedToDraft(true);
      return goDraft(question, true);
    }
    setBusy(false);
    setNeedsSignIn(Boolean(problem.signIn));
    setNotice(problem.message);
  }

  // Auto mode only: when no reviewed document matches, the request is answered as a question
  // instead of opening the catalogue (founder, 2026-10-24).
  async function goDraft(request: string, fromAuto = false) {
    const result = await openDraft({ request, course });
    if (result.ok && !result.matched && fromAuto) {
      setRoutedToDraft(false);
      const problem = await openNewChat(router, { question: request, course, mode: "learn" });
      if (!problem) return;
      setBusy(false);
      setNeedsSignIn(Boolean(problem.signIn));
      setNotice(problem.message);
      return;
    }
    if (result.ok) {
      router.push(result.href);
      return;
    }
    setBusy(false);
    setNeedsSignIn(Boolean(result.signIn));
    setNotice(result.message);
  }

  function applyShortcut(shortcut: (typeof SHORTCUTS)[number]) {
    setMode(shortcut.mode);
    if (shortcut.starter && !text) setText(shortcut.starter);
    inputRef.current?.focus();
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <form
        onSubmit={(event) => void submit(event)}
        // The box outlines itself while the student types (visible keyboard focus, WCAG 2.4.7).
        className="flex flex-col gap-2 rounded-3xl border border-line bg-surface px-2.5 pb-2.5 pt-3 shadow-[0_8px_28px_rgba(0,0,0,0.12)] has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-ink"
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
          className="resize-none bg-transparent px-2 text-[16px] leading-relaxed text-ink outline-none placeholder:text-muted sm:text-[17px]"
        />
        <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            aria-label="Attach a file"
            onClick={() =>
              setNotice(
                "Uploading your own files arrives in a later build (Phase 6).",
              )
            }
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pill text-ink sm:size-10"
          >
            <Icon name="plus" size={17} />
          </button>
          <Picker
            label="Mode"
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            options={MODES.map((m) => [m, m])}
          />
          <Picker
            label="Course"
            grow
            value={course}
            onChange={setCourse}
            options={[
              ["all", "All courses"],
              ...COURSES.map((c): [string, string] => [c.slug, c.name]),
            ]}
          />
          <span className="ml-auto" />
          <VoiceButton compact disabled={busy} onText={setText} onError={setNotice} />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || busy}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink disabled:bg-pill disabled:text-muted sm:size-10"
          >
            <Icon name="arrowUp" size={17} />
          </button>
        </div>
      </form>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted"
        >
          {notice}
          {needsSignIn && (
            <>
              {" "}
              <Link
                href="/sign-in"
                className="text-ink underline underline-offset-2"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      )}
      {routedToDraft && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-line px-3 py-1 text-muted">
            Treated as: Draft
          </span>
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

function Picker(props: {
  label: string;
  // Takes the spare width and shortens its text on small screens (the course list).
  grow?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const id = `picker-${props.label.toLowerCase()}`;
  return (
    <div className={`relative min-w-0 ${props.grow ? "max-w-[12rem] flex-1" : "shrink-0"}`}>
      <label htmlFor={id} className="sr-only">
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className={selectClass}
      >
        {props.options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
