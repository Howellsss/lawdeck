"use client";

import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { PracticeReveal } from "@/lib/practice";
import { markFlashcard } from "@/server/practice/actions";
import { RevealPanel } from "./RevealPanel";

export type Flashcard = { id: string; front: string; reveal: PracticeReveal | null; known: boolean | null };

// Flashcards one at a time (PRD LN-07): flip, then mark "Know it" or "Not yet". "Review not yet"
// brings back only the cards the student is still learning. Marks are saved on the server.
export function FlashcardDeck({ cards: initial }: { cards: Flashcard[] }) {
  const [cards, setCards] = useState(initial);
  const [reviewing, setReviewing] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const deck = reviewing ? cards.filter((card) => card.known !== true) : cards;
  const known = cards.filter((card) => card.known === true).length;
  const notYet = cards.length - known;
  const current = deck[Math.min(index, deck.length - 1)];

  function go(next: number, mode = reviewing) {
    setReviewing(mode);
    setIndex(next);
    setFlipped(false);
    setMessage(undefined);
  }

  async function mark(value: boolean) {
    if (!current) return;
    setBusy(true);
    const result = await markFlashcard({ itemId: current.id, known: value });
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setCards((all) => all.map((card) => (card.id === current.id ? { ...card, known: value } : card)));
    // In review, a card marked "know it" leaves the deck, so the same position shows the next card.
    go(reviewing && value ? index : index + 1);
  }

  const finished = index >= deck.length;

  return (
    <section aria-label="Flashcards" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">
          {known} of {cards.length} known{reviewing ? " · reviewing “not yet” cards" : ""}
        </p>
        {reviewing ? (
          <button type="button" onClick={() => go(0, false)} className="text-sm underline underline-offset-2">
            Show all cards
          </button>
        ) : (
          notYet > 0 && (
            <button type="button" onClick={() => go(0, true)} className="text-sm underline underline-offset-2">
              Review “not yet” cards ({notYet})
            </button>
          )
        )}
      </div>

      {finished || !current ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5">
          <p className="font-medium">
            {deck.length === 0 ? "You know every card in this set." : `End of the ${reviewing ? "review" : "set"}.`}
          </p>
          <div className="flex flex-wrap gap-3">
            {notYet > 0 && (
              <button type="button" onClick={() => go(0, true)} className={compactPrimaryButton}>
                Review “not yet” cards ({notYet})
              </button>
            )}
            <button type="button" onClick={() => go(0, false)} className={compactSecondaryButton}>
              Start again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">
            Card {Math.min(index, deck.length - 1) + 1} of {deck.length}
            {current.known === true && <span className="text-success"> · Known</span>}
            {current.known === false && <span className="text-warning"> · Not yet</span>}
          </p>
          <h3 className="whitespace-pre-line text-lg font-medium">{current.front}</h3>
          {flipped && current.reveal ? (
            <>
              <RevealPanel reveal={current.reveal} heading="Answer" />
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={() => void mark(true)} className={compactPrimaryButton}>
                  Know it
                </button>
                <button type="button" disabled={busy} onClick={() => void mark(false)} className={compactSecondaryButton}>
                  Not yet
                </button>
              </div>
            </>
          ) : (
            <div>
              <button type="button" onClick={() => setFlipped(true)} className={compactSecondaryButton}>
                Show answer
              </button>
            </div>
          )}
          {message && (
            <p role="alert" className="text-sm text-warning">
              {message}
            </p>
          )}
          <div className="flex justify-between text-sm">
            <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="underline underline-offset-2 disabled:no-underline disabled:opacity-50">
              Previous card
            </button>
            <button type="button" onClick={() => go(index + 1)} className="underline underline-offset-2">
              Skip
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
