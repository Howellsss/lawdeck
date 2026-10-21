import { listRecentChats, type ChatSummary } from "@/server/db/workspace";
import { RecentsList } from "./RecentsList";

// Server part of Recents: reads the student's latest chats after checking sign-in.
export async function RecentsSlot() {
  const state = await loadRecents();
  if (state === "signed-out") return <RecentsList message="Sign in to keep your chats." />;
  // A failed read must not break the whole menu; say so plainly instead.
  if (state === "failed") return <RecentsList message="Your chats couldn’t load. Reload the page to try again." />;
  if (state.length === 0) return <RecentsList message="Your chats will appear here." />;
  return <RecentsList chats={state} />;
}

async function loadRecents(): Promise<ChatSummary[] | "signed-out" | "failed"> {
  try {
    const result = await listRecentChats();
    return result.status === "signed-out" ? "signed-out" : result.data;
  } catch {
    return "failed";
  }
}
