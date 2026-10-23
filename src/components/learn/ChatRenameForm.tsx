"use client";

import { useActionState, useEffect } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { CHAT_TITLE_MAX } from "@/schemas/chats";
import { renameChat, type ChatMenuState } from "@/server/chats/actions";

const initialState: ChatMenuState = { status: "idle" };

export function ChatRenameForm({ chat, onDone }: { chat: { id: string; title: string }; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(renameChat, initialState);

  useEffect(() => {
    if (state.status === "saved") onDone();
  }, [state.status, onDone]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="id" value={chat.id} />
      <FormAlert message={state.message} />
      <TextField
        label="Chat name"
        name="title"
        maxLength={CHAT_TITLE_MAX}
        autoComplete="off"
        autoFocus
        required
        defaultValue={state.title ?? chat.title}
        error={state.fieldErrors?.title}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={compactPrimaryButton}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className={compactSecondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
