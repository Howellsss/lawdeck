"use client";

import { useState, useTransition } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { PRICE_ANSWERS } from "@/schemas/pilot";
import { answerPriceQuestion } from "@/server/pilot/actions";

// One question for pilot students, once per price: would they pay for Lawdeck (Phase 8 exit check:
// at least 15% willing to pay at the tested price).
export function PriceQuestion({ priceNgn }: { priceNgn: number }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const price = `₦${priceNgn.toLocaleString("en-NG")}`;

  if (message?.ok) return <p role="status" className="text-center text-sm text-muted">{message.text}</p>;
  return (
    <section aria-labelledby="price-question" className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
      <h2 id="price-question" className="text-base font-medium">
        Would you pay {price} a month for Lawdeck?
      </h2>
      <p className="text-sm text-muted">One quick question for pilot students. Your answer is private and helps us set a fair price.</p>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRICE_ANSWERS) as (keyof typeof PRICE_ANSWERS)[]).map((answer) => (
          <button
            key={answer}
            type="button"
            disabled={pending}
            className={compactSecondaryButton}
            onClick={() =>
              startTransition(async () => {
                const result = await answerPriceQuestion(answer, priceNgn);
                setMessage({ ok: result.ok, text: result.message ?? "" });
              })
            }
          >
            {PRICE_ANSWERS[answer]}
          </button>
        ))}
      </div>
    </section>
  );
}
