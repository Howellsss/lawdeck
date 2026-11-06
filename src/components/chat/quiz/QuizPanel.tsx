"use client";

import { useEffect, useState } from "react";
import { compactSecondaryButton, primaryButton } from "@/components/ui/buttons";
import type { QuizState } from "@/lib/quiz";
import { answerQuiz, createQuiz, endQuiz, joinQuiz, nextQuestion, quizState, type QuizTopic } from "@/server/chat/quiz";
import { QuizLeaderboard } from "./QuizLeaderboard";
import { QuizQuestion } from "./QuizQuestion";
import { QuizSetup } from "./QuizSetup";
import { useQuizSound } from "./useQuizSound";

// A study group's Quiz tab, like Kahoot: host a quiz, wait in the lobby, answer timed questions and
// see the leaderboard. While a quiz is on, the screen checks for changes every second.
export function QuizPanel({ groupId, initial, topics }: { groupId: string; initial: QuizState | null; topics: QuizTopic[] }) {
  const [quiz, setQuiz] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const sound = useQuizSound(quiz);
  const quizId = quiz?.id;
  const on = quiz && quiz.status !== "done";

  useEffect(() => {
    if (!quizId || !on) return;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const next = await quizState({ quizId });
      if (next) setQuiz(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [quizId, on]);

  const run = async (act: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    if (!quizId) return;
    setBusy(true);
    setError(undefined);
    const result = await act();
    if (!result.ok) setError(result.message);
    const next = await quizState({ quizId });
    if (next) setQuiz(next);
    setBusy(false);
  };

  const start = async (topicId: string, count: number, seconds: number) => {
    setBusy(true);
    setError(undefined);
    const result = await createQuiz({ groupId, topicId, count, seconds });
    if (!result.ok) return (setBusy(false), setError(result.message));
    setQuiz(await quizState({ quizId: result.quizId }));
    setBusy(false);
  };

  return (
    <div onPointerDown={sound.unlock} className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 lg:px-6">
      <button
        type="button"
        onClick={sound.toggle}
        aria-pressed={sound.on}
        aria-label={sound.on ? "Turn quiz sound off" : "Turn quiz sound on"}
        title={sound.on ? "Sound on" : "Sound off"}
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-lg border border-line text-[16px] lg:right-6"
      >
        <span aria-hidden>{sound.on ? "🔊" : "🔇"}</span>
      </button>
      {error && (
        <p role="alert" className="text-[14px] text-warning">
          {error}
        </p>
      )}
      {quiz?.status === "lobby" && (
        <section aria-label="Quiz lobby" className="flex max-w-xl flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="pr-12 font-serif text-2xl">Quiz on {quiz.topic}</h2>
          <p className="text-[15px] text-muted">
            {quiz.isHost ? "You’re hosting." : `Hosted by ${quiz.host}.`} {quiz.total} questions, {quiz.seconds} seconds each. {quiz.players} joined so far.
          </p>
          <div className="flex flex-wrap gap-2">
            {!quiz.joined && (
              <button type="button" disabled={busy} onClick={() => void run(() => joinQuiz({ quizId: quiz.id }))} className={primaryButton}>
                Join the quiz
              </button>
            )}
            {quiz.isHost && (
              <button type="button" disabled={busy} onClick={() => void run(() => nextQuestion({ quizId: quiz.id }))} className={primaryButton}>
                Start now
              </button>
            )}
            {quiz.joined && !quiz.isHost && <p className="text-[15px]">You&rsquo;re in. The quiz starts when {quiz.host} is ready.</p>}
          </div>
        </section>
      )}
      {quiz?.status === "live" && (
        <div className="flex max-w-2xl flex-col gap-5">
          <h2 className="pr-12 font-serif text-xl text-muted">Quiz on {quiz.topic}</h2>
          <QuizQuestion quiz={quiz} busy={busy} onAnswer={(choice) => void run(() => answerQuiz({ quizId: quiz.id, question: quiz.current, choice }))} />
          {!quiz.joined && (
            <button type="button" disabled={busy} onClick={() => void run(() => joinQuiz({ quizId: quiz.id }))} className={`${primaryButton} self-start`}>
              Join the quiz
            </button>
          )}
          {quiz.isHost && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !quiz.closed} onClick={() => void run(() => nextQuestion({ quizId: quiz.id }))} className={primaryButton}>
                {quiz.current + 1 >= quiz.total ? "See final results" : "Next question"}
              </button>
              <button type="button" disabled={busy} onClick={() => window.confirm("End the quiz for everyone now?") && void run(() => endQuiz({ quizId: quiz.id }))} className={compactSecondaryButton}>
                End quiz
              </button>
            </div>
          )}
          {quiz.closed && <QuizLeaderboard rows={quiz.leaderboard} total={quiz.total} />}
        </div>
      )}
      {quiz?.status === "done" && (
        <section aria-label="Quiz results" className="flex max-w-xl flex-col gap-3">
          <h2 className="pr-12 font-serif text-2xl">Quiz on {quiz.topic}: results</h2>
          <QuizLeaderboard rows={quiz.leaderboard} total={quiz.total} final />
        </section>
      )}
      {(!quiz || quiz.status === "done") && <QuizSetup topics={topics} busy={busy} onStart={(t, c, s) => void start(t, c, s)} />}
    </div>
  );
}
