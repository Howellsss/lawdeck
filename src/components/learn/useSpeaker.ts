"use client";

import { useSyncExternalStore } from "react";
import { speaker, type SpeakerState } from "./speaker";

const IDLE: SpeakerState = { status: "idle", key: null };

// What the shared player is doing, for buttons that show Read, Pause or Resume.
export function useSpeaker(): SpeakerState {
  return useSyncExternalStore(speaker.subscribe, speaker.getState, () => IDLE);
}
