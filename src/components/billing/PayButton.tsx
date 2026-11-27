"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { startCheckout } from "@/server/billing/checkout";

// Pay for one plan: the server starts the payment and Lawdeck moves to Flutterwave's own page.
export function PayButton({ planId, planName, price }: { planId: string; planName: string; price: string }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <FormAlert message={message} tone="warning" />
      <button
        type="button"
        disabled={pending}
        className={compactPrimaryButton}
        aria-label={`Pay ${price} for ${planName}`}
        onClick={() =>
          startTransition(async () => {
            setMessage(undefined);
            const result = await startCheckout({ planId });
            if (result.ok) window.location.assign(result.url);
            else setMessage(result.message);
          })
        }
      >
        {pending ? "Opening payment…" : `Pay ${price}`}
      </button>
    </div>
  );
}
