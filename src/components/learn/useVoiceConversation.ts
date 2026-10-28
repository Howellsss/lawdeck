"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readVoice } from "@/lib/voicePreference";
import { askQuestion } from "./askStream";
import { listenOnce, recognitionConstructor, voiceErrorMessage } from "./recognition";
import { speaker, type LiveAudio } from "./speaker";

// Voice mode (founder, 2026-10-28: "you press it, say something, it responds immediately there;
// it doesn't leave"). A spoken conversation on the same screen, like ChatGPT's voice mode:
// Lawdeck listens until the student pauses, then speaks its reply sentence by sentence while it is
// still being written (the server sends the audio with the text), then listens again. No
// commands are needed; End (or saying goodbye) finishes, and tapping while Lawdeck speaks
// interrupts it. The conversation is saved as a chat, readable afterwards.

export type Talk = "off" | "listening" | "thinking" | "speaking";

// Saying goodbye also ends voice mode, after Lawdeck says goodbye back.
const GOODBYE = /^(ok(ay)?[, ]+)?(good ?bye|bye( bye)?|end voice mode)\b/i;

export function useVoiceConversation(options: {
  // The chat to talk in; on the home screen it is created from the first thing said.
  chatFor: (firstQuestion: string) => Promise<{ ok: true; id: string } | { ok: false; message: string }>;
  onEnded?: (chatId: string | null, note: string | null) => void;
}) {
  const [talk, setTalk] = useState<Talk>("off");
  const [heard, setHeard] = useState("");
  const on = useRef(false);
  const chatId = useRef<string | null>(null);
  const listening = useRef<AbortController | null>(null);
  const answering = useRef<AbortController | null>(null);
  const interrupted = useRef(false);
  // The page can be hidden for a moment and shown again without leaving it (Next.js keeps pages
  // alive while it refreshes or navigates). Voice mode pauses while hidden and carries on when
  // shown; it never listens or speaks while hidden.
  const hidden = useRef(false);
  const shown = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const end = useCallback((message?: string) => {
    const wasOn = on.current;
    on.current = false;
    listening.current?.abort();
    answering.current?.abort();
    speaker.stop();
    setTalk("off");
    if (wasOn) optionsRef.current.onEnded?.(chatId.current, message ?? null);
    else if (message) optionsRef.current.onEnded?.(null, message);
  }, []);

  useEffect(() => {
    hidden.current = false;
    shown.current?.();
    shown.current = null;
    return () => {
      hidden.current = true;
      if (!on.current) return;
      interrupted.current = true;
      listening.current?.abort();
      speaker.stop();
    };
  }, []);

  // Leaving the page for good (closing or reloading it) ends voice mode.
  useEffect(() => {
    const leave = () => end();
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [end]);

  function whileHidden(): Promise<void> {
    return hidden.current ? new Promise((resolve) => (shown.current = resolve)) : Promise.resolve();
  }

  // One reply: asks, and plays each spoken sentence as it arrives. False when voice mode ends.
  async function reply(question: string): Promise<boolean> {
    if (!chatId.current) {
      const chat = await optionsRef.current.chatFor(question);
      if (!on.current) return false;
      if (!chat.ok) {
        end(chat.message);
        return false;
      }
      chatId.current = chat.id;
    }
    setTalk("thinking");
    interrupted.current = false;
    const controller = new AbortController();
    answering.current = controller;
    const audio: LiveAudio = speaker.live(() => setTalk("speaking"));
    let failure: string | null = null;
    let spoken = false;
    await askQuestion(
      chatId.current,
      question,
      "talk",
      (event) => {
        if (event.type === "audio") {
          spoken = true;
          audio.push(event.data);
        } else if (event.type === "audio_error") failure = event.message;
        else if (event.type === "error") failure = event.message;
      },
      controller.signal,
      readVoice(),
    );
    audio.end();
    if (!on.current) return false;
    if (interrupted.current) return true;
    if (failure && !spoken) {
      end(failure);
      return false;
    }
    const outcome = await audio.done;
    return on.current && (outcome !== "stopped" || interrupted.current);
  }

  async function run() {
    // Guards against a microphone that fails instantly over and over.
    let quickFailures = 0;
    while (on.current) {
      await whileHidden();
      if (!on.current) return;
      setTalk("listening");
      const controller = new AbortController();
      listening.current = controller;
      const startedAt = Date.now();
      let question: string;
      try {
        question = await listenOnce(controller.signal);
      } catch (error) {
        if (!on.current) return;
        const code = (error as Error).message;
        // Silence is part of a conversation: keep waiting until the student speaks or presses End.
        if (code === "no-speech" || code === "aborted") {
          quickFailures = Date.now() - startedAt < 1000 ? quickFailures + 1 : 0;
          if (quickFailures >= 5) return end("Voice mode stopped: the microphone isn’t responding. Try again.");
          continue;
        }
        return end(voiceErrorMessage(code));
      }
      if (!on.current) return;
      quickFailures = 0;
      setHeard(question);
      const leaving = GOODBYE.test(question);
      if (!(await reply(question))) return;
      if (leaving) return end();
    }
  }

  // Call from a tap: phones only allow audio that a tap started.
  function begin() {
    if (!recognitionConstructor()) {
      optionsRef.current.onEnded?.(null, "Voice mode needs a browser that understands speech, such as Chrome or Safari.");
      return;
    }
    speaker.unlock();
    on.current = true;
    setHeard("");
    void run();
  }

  // Tapping while Lawdeck speaks: it stops and listens straight away.
  function interrupt() {
    if (!on.current || talk === "listening") return;
    interrupted.current = true;
    answering.current?.abort();
    speaker.stop();
  }

  return { talk, heard, begin, interrupt, end: () => end() };
}
