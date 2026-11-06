"use client";

import { useEffect, useRef, useState } from "react";
import type { QuizState } from "@/lib/quiz";
import { musicFor, QuizSound } from "@/lib/quizSound";

const KEY = "lawdeck-quiz-sound";

function readOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

// Plays the quiz music and sounds as the quiz moves on: lobby music, "3, 2, 1" beeps, question music
// that speeds up near the end, a chime or a low tone when the answer shows, and a fanfare for the
// final leaderboard. Sound on or off is remembered on this phone.
export function useQuizSound(quiz: QuizState | null) {
  const sound = useRef<QuizSound | null>(null);
  const [on, setOn] = useState(readOn);
  const last = useRef({ ready: -1, revealed: -1, done: false });

  const engine = () => (sound.current ??= new QuizSound());

  // Phones allow sound only after a tap: any tap on the quiz wakes it.
  const unlock = () => {
    const s = engine();
    s.unlock();
    s.setMuted(!on);
  };

  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      // Private windows may block storage; the switch still works for this visit.
    }
    const s = engine();
    s.unlock();
    s.setMuted(!next);
  };

  useEffect(() => () => sound.current?.close(), []);

  useEffect(() => {
    const s = sound.current;
    if (!s || !quiz) return;
    s.music(musicFor(quiz.status, quiz.readyIn, quiz.closed, quiz.secondsLeft));
    if (quiz.status === "live" && quiz.readyIn > 0) {
      const n = Math.ceil(quiz.readyIn);
      if (n !== last.current.ready) {
        last.current.ready = n;
        s.countdown(false);
      }
    }
    if (quiz.status === "live" && quiz.closed && last.current.revealed !== quiz.current) {
      last.current.revealed = quiz.current;
      if (quiz.myCorrect) s.correct();
      else if (quiz.myChoice !== null) s.wrong();
    }
    if (quiz.status === "done" && !last.current.done) {
      last.current.done = true;
      s.fanfare();
    }
  }, [quiz]);

  return { on, toggle, unlock };
}
