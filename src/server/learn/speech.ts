import "server-only";
import { answerScope, speakableText, speechParts } from "@/lib/speech";
import type { SpeechScope, Voice } from "@/schemas/voice";
import { SPEECH_DAILY_CHARS, synthesizeSpeech } from "@/server/ai/speech";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { messageText } from "@/server/db/workspace";

export const MORE_QUESTION = "Would you like me to read the full explanation?";

export type SpokenPart =
  | { ok: true; audio: ArrayBuffer; parts: number }
  | { ok: false; status: number; message: string };

// The parts of a saved answer to read, as spoken text. Row-level security means a student can
// only load answers in their own chats; anyone else's answer is simply "not found".
async function answerParts(messageId: string, scope: SpeechScope): Promise<string[] | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("id", messageId)
    .maybeSingle();
  if (error || !data || data.role !== "assistant") return null;
  const text = messageText(data.content);
  let spoken = speakableText(answerScope(text, scope));
  // Voice conversations read the short answer first, then offer the rest.
  if (scope === "short" && answerScope(text, "rest")) spoken += ` ${MORE_QUESTION}`;
  return speechParts(spoken);
}

// Daily limit (cost control): checked before every part, from what was recorded today.
async function withinDailyLimit(chars: number): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("speech_used_today");
  const row = data?.[0];
  if (error || !row) return false;
  return Boolean(row.unlimited) || Number(row.used) + chars <= SPEECH_DAILY_CHARS;
}

// One part of an answer as audio. Parts are read one after another, so the first is heard quickly.
export async function speakAnswerPart(input: {
  messageId: string;
  part: number;
  scope: SpeechScope;
  voice: Voice;
}): Promise<SpokenPart> {
  const parts = await answerParts(input.messageId, input.scope);
  if (!parts) return { ok: false, status: 404, message: "That answer could not be found." };
  const text = parts[input.part];
  if (!text) return { ok: false, status: 404, message: "There is nothing more to read." };
  return speakText(text, input.voice, parts.length);
}

export async function speakText(text: string, voice: Voice, parts = 1): Promise<SpokenPart> {
  if (!(await withinDailyLimit(text.length)))
    return {
      ok: false,
      status: 429,
      message: "You have reached today’s reading-aloud limit. It resets at midnight; you can still read the answer on screen.",
    };
  const result = await synthesizeSpeech(text, voice);
  return result.ok
    ? { ok: true, audio: result.audio, parts }
    : {
        ok: false,
        status: 503,
        message:
          result.reason === "busy"
            ? "Lawdeck’s voice is busy. Wait a moment and press Read again."
            : "Lawdeck’s voice is not available right now. You can still read the answer on screen.",
      };
}
