import { DEFAULT_VOICE, VOICES, type Voice } from "@/schemas/voice";

// The voice a student chose on the Account page, kept in this browser like the theme.
export const VOICE_STORAGE_KEY = "lawdeck-voice";

export function readVoice(): Voice {
  try {
    const saved = localStorage.getItem(VOICE_STORAGE_KEY);
    return (VOICES as readonly string[]).includes(saved ?? "") ? (saved as Voice) : DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export function saveVoice(voice: Voice) {
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, voice);
  } catch {
    // Private browsing may block storage; the default voice is used.
  }
}
