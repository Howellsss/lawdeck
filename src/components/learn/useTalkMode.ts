"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listenOnce, recognitionConstructor, voiceErrorMessage } from "./recognition";
import { speaker } from "./speaker";

// Voice mode (founder, 2026-10-28: "something I can communicate with ... back and forth").
// Lawdeck listens, answers in a few spoken sentences that end with a question back to the
// student, reads them aloud, then listens again, until the student says "stop" or presses End.
// "Tap to speak" interrupts Lawdeck while it is speaking.

export type Talk = "off" | "listening" | "thinking" | "speaking";
export type Answered = { id: string; text: string } | null;

const END = /^(stop|end|exit|goodbye|bye|that'?s all)\b/i;

export function useTalkMode(ask: (question: string) => Promise<Answered>) {
  const [talk, setTalk] = useState<Talk>("off");
  const [note, setNote] = useState<string | null>(null);
  const on = useRef(false);
  const interrupted = useRef(false);
  const listening = useRef<AbortController | null>(null);
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });

  // keepAudio: the student pressed Read on an answer, which took over the player; leave it playing.
  const end = useCallback((message?: string, keepAudio = false) => {
    on.current = false;
    listening.current?.abort();
    if (!keepAudio) speaker.stop();
    setTalk("off");
    setNote(message ?? null);
  }, []);

  useEffect(() => () => end(), [end]);

  // Reads a reply aloud; false when voice mode should not go on.
  async function speak(id: string): Promise<boolean> {
    setTalk("speaking");
    interrupted.current = false;
    const outcome = await speaker.play(id, "full");
    if (outcome === "error") end(speaker.getState().message ?? "Lawdeck’s voice is not available right now.");
    else if (outcome === "stopped" && on.current && !interrupted.current) end(undefined, true);
    return on.current && (outcome === "done" || interrupted.current);
  }

  async function run(first?: string) {
    let question = first;
    while (on.current) {
      if (!question) {
        setTalk("listening");
        const controller = new AbortController();
        listening.current = controller;
        try {
          question = await listenOnce(controller.signal);
        } catch (error) {
          if (!on.current) return;
          const code = (error as Error).message;
          return end(code === "no-speech" ? "Voice mode ended: Lawdeck didn’t hear anything." : voiceErrorMessage(code));
        }
        if (!on.current) return;
        if (END.test(question)) return end();
      }
      setTalk("thinking");
      const answered = await askRef.current(question);
      question = undefined;
      if (!on.current) return;
      if (!answered) return end("Voice mode ended because the answer did not finish.");
      if (!(await speak(answered.id))) return;
    }
  }

  // Call from a tap (phones only allow audio that a tap started). With a question, voice mode
  // starts by asking it (a question spoken on the home screen).
  function begin(first?: string) {
    if (!recognitionConstructor()) {
      setNote("Voice mode needs a browser that understands speech, such as Chrome or Safari.");
      return;
    }
    speaker.unlock();
    on.current = true;
    setNote(null);
    void run(first);
  }

  // Stops Lawdeck mid-sentence and listens to the student straight away.
  function interrupt() {
    if (!on.current || talk !== "speaking") return;
    interrupted.current = true;
    speaker.stop();
  }

  return { talk, note, begin, interrupt, end: () => end() };
}
