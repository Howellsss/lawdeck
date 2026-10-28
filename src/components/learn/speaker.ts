"use client";

import { readVoice } from "@/lib/voicePreference";
import type { SpeechScope } from "@/schemas/voice";

// Plays answers read aloud (founder, 2026-10-28). One player for the whole app, so starting a
// new answer stops the one already playing. An answer is fetched in parts: the next part is
// fetched while the current one plays, so there is no gap between them.

export type SpeakerState = {
  status: "idle" | "loading" | "playing" | "paused" | "error";
  // Which answer and part of it ("<message id>:<scope>"), or null when nothing is playing.
  key: string | null;
  message?: string;
};
export type SpeakOutcome = "done" | "stopped" | "error";
export type LiveAudio = { push: (base64: string) => void; end: () => void; done: Promise<SpeakOutcome> };

// A tenth of a second of silence: played during a tap so phones allow audio started later
// (voice conversations speak after the answer is written, not straight after a tap).
const SILENCE =
  "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

let state: SpeakerState = { status: "idle", key: null };
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let run = 0;
let finishPart: ((outcome: SpeakOutcome) => void) | null = null;
let urls: string[] = [];

function set(next: SpeakerState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function player(): HTMLAudioElement {
  audio ??= new Audio();
  return audio;
}

export const speaker = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // Call during a tap, before audio that will start later.
  unlock() {
    const element = player();
    element.src = SILENCE;
    void element.play().catch(() => {});
  },

  async play(messageId: string, scope: SpeechScope): Promise<SpeakOutcome> {
    speaker.stop();
    const mine = ++run;
    const key = `${messageId}:${scope}`;
    const voice = readVoice();
    set({ status: "loading", key });
    let next = fetchPart(messageId, scope, 0, voice);
    for (let part = 0; ; part++) {
      const fetched = await next;
      if (mine !== run) return "stopped";
      if ("message" in fetched) {
        set({ status: "error", key, message: fetched.message });
        return "error";
      }
      if (part + 1 < fetched.parts) next = fetchPart(messageId, scope, part + 1, voice);
      set({ status: "playing", key });
      const outcome = await playUrl(fetched.url);
      if (mine !== run) return "stopped";
      if (outcome === "error") {
        cleanUp();
        set({ status: "error", key, message: "The audio could not play. Press Read again." });
        return "error";
      }
      if (outcome === "stopped") return "stopped";
      if (part + 1 >= fetched.parts) break;
      set({ status: "loading", key });
    }
    cleanUp();
    set({ status: "idle", key: null });
    return "done";
  },

  // Voice mode: plays spoken sentences one after another as they arrive from the server.
  // onStart runs when the first one starts playing.
  live(onStart?: () => void): LiveAudio {
    speaker.stop();
    const mine = ++run;
    const queue: string[] = [];
    let playing = false;
    let ended = false;
    let started = false;
    let settle!: (outcome: SpeakOutcome) => void;
    const done = new Promise<SpeakOutcome>((resolve) => (settle = resolve));
    const next = async () => {
      if (mine !== run) return settle("stopped");
      const url = queue.shift();
      if (!url) {
        playing = false;
        if (ended) {
          cleanUp();
          set({ status: "idle", key: null });
          settle("done");
        }
        return;
      }
      playing = true;
      if (!started) {
        started = true;
        onStart?.();
      }
      set({ status: "playing", key: "live" });
      const outcome = await playUrl(url);
      if (outcome === "stopped" || mine !== run) return settle("stopped");
      // A sentence that cannot play is skipped, so one bad part never stops the conversation.
      void next();
    };
    return {
      push(base64: string) {
        if (mine !== run) return;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        urls.push(url);
        queue.push(url);
        if (!playing) void next();
      },
      end() {
        ended = true;
        if (!playing) void next();
      },
      done,
    };
  },

  pause() {
    if (state.status !== "playing") return;
    player().pause();
    set({ ...state, status: "paused" });
  },

  resume() {
    if (state.status !== "paused") return;
    void player().play();
    set({ ...state, status: "playing" });
  },

  stop() {
    run++;
    audio?.pause();
    finishPart?.("stopped");
    cleanUp();
    if (state.status !== "idle") set({ status: "idle", key: null });
  },
};

function cleanUp() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls = [];
  finishPart = null;
}

async function fetchPart(
  messageId: string,
  scope: SpeechScope,
  part: number,
  voice: string,
): Promise<{ url: string; parts: number } | { message: string }> {
  try {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, part, scope, voice }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      return { message: body?.message ?? "Lawdeck’s voice is not available right now." };
    }
    const url = URL.createObjectURL(await response.blob());
    urls.push(url);
    return { url, parts: Number(response.headers.get("X-Speech-Parts")) || 1 };
  } catch {
    return { message: "Reading aloud needs an internet connection. Check it and try again." };
  }
}

function playUrl(url: string): Promise<SpeakOutcome> {
  return new Promise((resolve) => {
    const element = player();
    finishPart = resolve;
    element.onended = () => resolve("done");
    element.onerror = () => resolve("error");
    element.src = url;
    element.play().catch(() => resolve("error"));
  });
}
