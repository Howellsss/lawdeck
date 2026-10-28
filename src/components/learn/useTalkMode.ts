"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { answerScope } from "@/lib/speech";
import { listenOnce, recognitionConstructor, voiceErrorMessage } from "./recognition";
import { speaker } from "./speaker";

// Voice mode (founder, 2026-10-28: "speak to it and it responds with a voice"). Lawdeck listens,
// asks the question, reads the short answer aloud, offers the rest, then listens again, until
// the student says "stop" or presses End.

export type Talk = "off" | "listening" | "thinking" | "speaking";
export type Answered = { id: string; text: string } | null;

const YES = /^(yes|yeah|yep|yup|ok(ay)?|sure|please|go on|go ahead|continue|read (it|on|more|the rest))\b/i;
const NO = /^(no|nope|not now|no thanks)\b/i;
const END = /^(stop|end|exit|goodbye|bye|that'?s all)\b/i;

export function useTalkMode(ask: (question: string) => Promise<Answered>) {
  const [talk, setTalk] = useState<Talk>("off");
  const [offering, setOffering] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const on = useRef(false);
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
    setOffering(false);
    setTalk("off");
    setNote(message ?? null);
  }, []);

  useEffect(() => () => end(), [end]);

  // Reads part of an answer; false when voice mode should not go on.
  async function speak(id: string, scope: "short" | "rest"): Promise<boolean> {
    setTalk("speaking");
    const outcome = await speaker.play(id, scope);
    if (outcome === "error") end(speaker.getState().message ?? "Lawdeck’s voice is not available right now.");
    else if (outcome === "stopped" && on.current) end(undefined, true);
    return outcome === "done" && on.current;
  }

  async function run(first?: string) {
    let more: string | null = null;
    let question = first;
    while (on.current) {
      if (!question) {
        setTalk("listening");
        setOffering(Boolean(more));
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
        setOffering(false);
        const offered = more;
        more = null;
        if (offered && YES.test(question)) {
          question = undefined;
          if (!(await speak(offered, "rest"))) return;
          continue;
        }
        if (END.test(question)) return end();
        if (offered && NO.test(question)) {
          question = undefined;
          continue;
        }
      }
      setTalk("thinking");
      const answered = await askRef.current(question);
      question = undefined;
      if (!on.current) return;
      if (!answered) return end("Voice mode ended because the answer did not finish.");
      if (!(await speak(answered.id, "short"))) return;
      more = answerScope(answered.text, "rest") ? answered.id : null;
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

  return { talk, offering, note, begin, end: () => end() };
}
