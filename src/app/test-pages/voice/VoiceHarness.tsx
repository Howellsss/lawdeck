"use client";

import { ChatThread } from "@/components/learn/ChatThread";
import { AppShell } from "@/components/shell/AppShell";

export const TEST_CHAT_ID = "11111111-1111-4111-8111-111111111111";

export function VoiceHarness() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-4">
        <ChatThread chatId={TEST_CHAT_ID} initialMessages={[]} voice />
      </div>
    </AppShell>
  );
}
