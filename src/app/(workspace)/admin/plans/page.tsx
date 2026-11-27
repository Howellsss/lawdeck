import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanLimitsForm } from "@/components/billing/PlanLimitsForm";
import { PlanPriceForm } from "@/components/billing/PlanPriceForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getPlansAdmin } from "@/server/billing/plans";

export const metadata: Metadata = { title: "Plans · Lawdeck" };

// What a credit buys, in words for the admin (credit_costs, migration 68).
const JOB_NAMES: Record<string, string> = {
  explain: "An ordinary answer (or a voice reply that teaches)",
  problem: "A problem question",
  practice: "A practice set",
  brief: "A brief",
  marking: "Marking a practice answer",
  draft: "Drafting a document",
  memory_aid: "A memory aid made on request",
};

// Admin → Plans (launch task 15): each plan's monthly price and credits. Admins only; everyone
// else gets "page not found".
export default function PlansPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the plans" />}>
        <Plans />
      </Suspense>
    </div>
  );
}

async function Plans() {
  const data = await getPlansAdmin();
  if (!data) notFound();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Plans</h1>
        <p className="text-muted">
          Each plan’s monthly price and credits. A change applies to new payments at once; students who already paid keep
          what they paid for until their month ends. Before raising a price, tell students at least 14 days ahead (the
          Terms, section 3). Every change is recorded.
        </p>
      </div>
      {data.plans.length <= 1 ? (
        <p role="alert" className="text-sm text-warning">
          The plans need the latest database updates (68 and 74). Paste them into Supabase, then reload this page.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.plans.map((plan) => (
            <PlanPriceForm key={plan.id} plan={plan} />
          ))}
        </div>
      )}
      {data.plans.length > 1 && (
        <section aria-labelledby="limits-heading" className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 id="limits-heading" className="text-lg font-medium">
            Limits within the month
          </h2>
          <p className="text-sm text-muted">
            Like Claude: a small allowance that refills a few hours after the first question, and a weekly allowance counted
            from the day the student paid. The monthly credits above stay the overall total. The Free plan is the 7-day trial.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.plans.map((plan) => (
              <PlanLimitsForm key={plan.id} plan={plan} />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="costs-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="costs-heading" className="text-lg font-medium">What each job costs</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {data.costs.map((cost) => (
            <li key={cost.kind}>
              {JOB_NAMES[cost.kind] ?? cost.kind}: <b>{cost.credits}</b> credit{cost.credits === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Reading answers aloud and voice small talk are free.</p>
      </section>
    </>
  );
}
