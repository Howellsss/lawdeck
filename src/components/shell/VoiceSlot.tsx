import { VoiceSelect } from "@/components/voice/VoiceSelect";
import { speechConfigured } from "@/server/ai/speech";
import { getCurrentAccount } from "@/server/auth/session";

// The reading voice in the side menu, on every page (founder, 2026-10-31: "users should be allowed
// to select the voices"). The same choice as on the Account page, beside Read and in voice mode.
// Shown to signed-in people once Lawdeck's voice is switched on.
export async function VoiceSlot() {
  if (!speechConfigured() || !(await getCurrentAccount())) return null;
  return (
    <div className="shrink-0 border-t border-line pb-1 pt-3">
      <VoiceSelect className="w-full justify-between px-1" />
    </div>
  );
}
