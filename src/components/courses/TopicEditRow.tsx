"use client";

import { useState, useTransition } from "react";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { moveTopic, removeTopic, renameTopic, type TopicResult } from "@/server/courses/actions";
import type { TopicSummary } from "@/server/db/workspace";

const linkButton = "text-sm underline underline-offset-2 disabled:opacity-50";

// One topic in the admin editor: rename, move up or down, or remove after a confirmation.
export function TopicEditRow({ topic, first, last }: { topic: TopicSummary; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(topic.name);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<TopicResult>, after?: () => void) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setMessage(result.message);
      after?.();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(() => renameTopic(topic.id, name), () => setEditing(false));
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <label htmlFor={`rename-${topic.id}`} className="sr-only">
            New name for {topic.name}
          </label>
          <input
            id={`rename-${topic.id}`}
            value={name}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            className="h-11 flex-1 rounded-full border border-line bg-sidebar px-4 text-[15px]"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={compactSecondaryButton}>
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className={linkButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-words text-[15px]">{topic.name}</span>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={pending || first} onClick={() => run(() => moveTopic(topic.id, "up"))} className={linkButton}>
              Up<span className="sr-only"> {topic.name}</span>
            </button>
            <button type="button" disabled={pending || last} onClick={() => run(() => moveTopic(topic.id, "down"))} className={linkButton}>
              Down<span className="sr-only"> {topic.name}</span>
            </button>
            <button type="button" disabled={pending} onClick={() => setEditing(true)} className={linkButton}>
              Rename<span className="sr-only"> {topic.name}</span>
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(true)} className={`${linkButton} text-warning`}>
              Remove<span className="sr-only"> {topic.name}</span>
            </button>
          </div>
        </div>
      )}
      {confirming && (
        <div role="group" aria-label={`Remove ${topic.name}?`} className="flex flex-wrap items-center gap-2 text-sm">
          <span>Remove this topic? Chats already started from it are kept.</span>
          <button type="button" disabled={pending} onClick={() => run(() => removeTopic(topic.id))} className={compactWarningButton}>
            {pending ? "Removing…" : "Yes, remove"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={compactSecondaryButton}>
            Cancel
          </button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </li>
  );
}
