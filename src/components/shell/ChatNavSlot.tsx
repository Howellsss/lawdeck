import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed } from "@/server/chat/data";
import { ChatNav } from "./ChatNav";

// Shows the Campus chat link to staff, and to every signed-in student once chat is open to students
// (unverified students land on the verification form). Hiding it is only a convenience: the chat
// pages and the database check access themselves.
async function showChat(): Promise<boolean> {
  try {
    if (!(await getCurrentAccount())) return false;
    if (await chatAllowed()) return true;
    const db = await createSupabaseServerClient();
    const { data } = await db.from("chat_settings").select("open_to_students").maybeSingle();
    return Boolean(data?.open_to_students);
  } catch {
    return false;
  }
}

export async function ChatNavSlot() {
  return (await showChat()) ? <ChatNav /> : null;
}
