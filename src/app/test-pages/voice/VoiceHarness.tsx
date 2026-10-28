"use client";

import { useState } from "react";
import { VoiceMode } from "@/components/learn/VoiceMode";

export const TEST_CHAT_ID = "11111111-1111-4111-8111-111111111111";

// Voice mode on its own, as on the home screen, with a made-up chat.
export function VoiceHarness() {
  const [ended, setEnded] = useState<string | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1>Voice test page</h1>
      <VoiceMode
        chatFor={async () => ({ ok: true, id: TEST_CHAT_ID })}
        onEnded={(chatId, note) => setEnded(note ?? `ended in ${chatId}`)}
      />
      {ended && <p role="status">{ended}</p>}
    </div>
  );
}
