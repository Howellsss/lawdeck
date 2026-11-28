import type { Metadata } from "next";
import { Suspense } from "react";
import { PayButton } from "@/components/billing/PayButton";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatWat } from "@/lib/dates";
import { trialEndDay, trialStatus } from "@/lib/trial";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getAllowance } from "@/server/learn/allowance";
import { getCurrentAccount } from "@/server/auth/session";
import { flutterwaveConfigured } from "@/server/billing/flutterwave";
import { getPlansForStudent } from "@/server/billing/plans";

export const metadata: Metadata = { title: "Plans · Lawdeck" };

const naira = (value: number) => `₦${value.toLocaleString("en-NG")}`;

// Plans (launch task 15, part 2): the paid plans and a Pay button for each. Paying opens
// Flutterwave's own page (card, bank transfer or USSD); each payment gives one month.
export default function StudentPlansPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the plans" />}>
        <Plans />
      </Suspense>
    </div>
  );
}

async function Plans() {
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="plans" returnTo="/plans" />;
  const [data, allowance] = await Promise.all([
    getPlansForStudent().catch(() => null),
    createSupabaseServerClient().then((db) => getAllowance(db)),
  ]);
  const trial = trialStatus(allowance, new Date());
  if (!data) return <StateMessage tone="warning" title="The plans could not be loaded">Please reload the page in a minute.</StateMessage>;
  const open = flutterwaveConfigured();
  const current = data.current;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Plans</h1>
        <p className="text-muted">
          Each payment gives one month. Nothing renews by itself: pay again when you want another month. Paying before your
          month ends adds the new month on top, so you never lose days.
        </p>
        {trial && (
          <p className={`text-sm ${trial.state === "active" ? "" : "text-warning"}`}>
            {trial.state === "ended"
              ? "Your 7-day free trial has ended. Choose a plan below to keep studying; your work so far is kept."
              : trial.state === "used"
                ? `You’ve used all ${trial.credits} trial credits. Choose a plan below to keep studying.`
                : `You’re on the 7-day free trial until ${trialEndDay(trial.endsAt)}: ${trial.creditsLeft} of ${trial.credits} trial credits left. No card needed until you choose a plan.`}
          </p>
        )}
        {current && !trial && (
          <p className="text-sm">
            You are on <span className="font-medium">{current.name}</span>
            {current.periodEnd ? ` until ${formatWat(current.periodEnd)}.` : "."}
          </p>
        )}
      </div>
      {!open && <StateMessage level={2} title="Payments open soon">You can see the plans now; paying will be possible shortly.</StateMessage>}
      {data.plans.length === 0 ? (
        <StateMessage level={2} title="No plans on sale yet">Please check back soon.</StateMessage>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {data.plans.map((plan) => (
            <li key={plan.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
              <h2 className="text-lg font-medium">{plan.name}</h2>
              <p>
                <span className="font-serif text-3xl">{naira(plan.priceNgn)}</span>
                <span className="text-sm text-muted"> a month</span>
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                <li>{plan.credits} credits a month</li>
                {plan.weeklyCredits !== null && <li>Up to {plan.weeklyCredits} a week</li>}
                {plan.windowCredits !== null && (
                  <li>
                    Up to {plan.windowCredits} every {plan.windowHours} hours
                  </li>
                )}
              </ul>
              {open && <PayButton planId={plan.id} planName={plan.name} price={naira(plan.priceNgn)} />}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">
        An ordinary question is 1 credit; a brief 2; a problem question, marking an answer or a draft 3. Reading answers aloud is
        free. The few-hours allowance refills that long after your first question; weeks count from the day you paid.
      </p>
      <p className="text-sm text-muted">Payments are made on Flutterwave’s secure page. Lawdeck never sees or keeps your card details.</p>
    </>
  );
}
