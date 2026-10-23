"use client";

import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { deleteChat, type ChatMenuState } from "@/server/chats/actions";

const initialState: ChatMenuState = { status: "idle" };

// Deleting is permanent, so the menu asks first. A student on the deleted chat's page is
// taken to the home page.
export function ChatDeleteConfirm({ chat, onCancel }: { chat: { id: string; title: string }; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(deleteChat, initialState);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "deleted" && pathname === `/chats/${chat.id}`) router.replace("/");
  }, [state.status, pathname, chat.id, router]);

  return (
    <form action={formAction} role="group" aria-labelledby={`delete-chat-${chat.id}`} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={chat.id} />
      <p id={`delete-chat-${chat.id}`} className="text-[15px] leading-relaxed">
        Delete this chat? <strong className="break-words">{chat.title}</strong> and all its messages will be removed.
        This can’t be undone.
      </p>
      <FormAlert message={state.message} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" autoFocus disabled={pending} className={compactWarningButton}>
          {pending ? "Deleting…" : "Yes, delete it"}
        </button>
        <button type="button" onClick={onCancel} className={compactSecondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
