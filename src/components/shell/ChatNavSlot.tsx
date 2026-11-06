import { chatAllowed } from "@/server/chat/data";
import { ChatNav } from "./ChatNav";

// Shows the Campus chat link only to people chat is open to. Hiding it is only a convenience: the
// chat pages and the database check access themselves.
export async function ChatNavSlot() {
  const allowed = await chatAllowed().catch(() => false);
  return allowed ? <ChatNav /> : null;
}
