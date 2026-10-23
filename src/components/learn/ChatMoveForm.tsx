"use client";

import Link from "next/link";
import { useActionState, useEffect, useId } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { moveChat, type ChatMenuState } from "@/server/chats/actions";

export type ProjectOption = { id: string; name: string };

const initialState: ChatMenuState = { status: "idle" };

// Puts the chat into one of the student's projects, or takes it out ("No project").
export function ChatMoveForm({
  chat,
  projects,
  onDone,
}: {
  chat: { id: string; projectId: string | null };
  projects: ProjectOption[] | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(moveChat, initialState);
  const selectId = useId();

  useEffect(() => {
    if (state.status === "saved") onDone();
  }, [state.status, onDone]);

  if (projects === null || projects.length === 0) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p>
          {projects === null
            ? "Your projects couldn’t load. Reload the page to try again."
            : "You have no projects yet."}{" "}
          <Link href="/projects">Go to Projects</Link>
        </p>
        <button type="button" autoFocus onClick={onDone} className={compactSecondaryButton}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={chat.id} />
      <FormAlert message={state.message} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="px-1 text-sm font-medium">
          Project
        </label>
        <select
          id={selectId}
          name="projectId"
          autoFocus
          defaultValue={chat.projectId ?? ""}
          className="h-12 rounded-full border border-line bg-sidebar px-4 text-[15px] text-ink"
        >
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={compactPrimaryButton}>
          {pending ? "Moving…" : "Move"}
        </button>
        <button type="button" onClick={onDone} className={compactSecondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
