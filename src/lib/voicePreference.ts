import { DEFAULT_VOICE, VOICES, type Voice } from "@/schemas/voice";

// The voice a student chose (Account page, voice mode or beside Read), kept in this browser like
// the theme. Every picker on the page follows a change made in any of them.
export const VOICE_STORAGE_KEY = "lawdeck-voice";

const listeners = new Set<() => void>();

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
  listeners.forEach((listener) => listener());
}

// For useSyncExternalStore: changes here and in other tabs.
export function subscribeVoice(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === VOICE_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
