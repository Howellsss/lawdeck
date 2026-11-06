import { getCurrentAccount } from "@/server/auth/session";
import { ChatNav } from "./ChatNav";

// Shows the Campus chat link to everyone signed in (founder, 2026-11-06): students who can't use chat
// yet land on the verification form, which asks their campus. Hiding it is only a convenience: the
// chat pages and the database check access themselves.
async function showChat(): Promise<boolean> {
  try {
    return Boolean(await getCurrentAccount());
  } catch {
    return false;
  }
}

export async function ChatNavSlot() {
  return (await showChat()) ? <ChatNav /> : null;
}
