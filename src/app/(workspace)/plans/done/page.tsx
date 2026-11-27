import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatWat } from "@/lib/dates";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { confirmPayment, transactionIdSchema, txRefSchema } from "@/server/billing/flutterwave";

export const metadata: Metadata = { title: "Payment · Lawdeck" };

type Search = Promise<Record<string, string | string[] | undefined>>;

// Where Flutterwave sends the student after paying. Nothing in the address is trusted: the
// payment must be the student's own, and Lawdeck asks Flutterwave itself whether it succeeded.
export default function PaymentDonePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Checking your payment" />}>
        <Outcome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const plansLink = { label: "Back to plans", href: "/plans" };

async function Outcome({ searchParams }: { searchParams: Search }) {
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="payment" returnTo="/plans" />;
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const ref = txRefSchema.safeParse(one("tx_ref"));
  if (!ref.success) return <StateMessage title="Payment not found" action={plansLink}>Choose a plan to pay.</StateMessage>;

  // Row-level security: only the student's own payments can be read.
  const supabase = await createSupabaseServerClient();
  const own = await supabase.from("payments").select("status").eq("tx_ref", ref.data).maybeSingle();
  if (!own.data) return <StateMessage title="Payment not found" action={plansLink}>This payment is not on your account.</StateMessage>;

  const id = transactionIdSchema.safeParse(one("transaction_id"));
  if (one("status") === "cancelled" || !id.success) {
    return <StateMessage title="Payment not completed" action={plansLink}>Nothing was charged. You can try again at any time.</StateMessage>;
  }
  const result = await confirmPayment(ref.data, id.data);
  if (result.status === "paid") {
    return (
      <StateMessage title="Payment received" action={{ label: "Start studying", href: "/" }}>
        You are on {result.planName} until {formatWat(result.periodEnd)}. Your new credits are ready now.
      </StateMessage>
    );
  }
  if (result.status === "pending") {
    return (
      <StateMessage title="Payment still processing" action={plansLink}>
        Flutterwave has not confirmed it yet (bank transfers can take a few minutes). Your plan starts as soon as it does; reload this page to check.
      </StateMessage>
    );
  }
  if (result.status === "failed") {
    return <StateMessage tone="warning" title="Payment failed" action={plansLink}>Nothing was charged. Please try again, or use another card or bank.</StateMessage>;
  }
  return (
    <StateMessage tone="warning" title="We could not confirm this payment yet" action={plansLink}>
      If you were charged, your plan will start as soon as Flutterwave confirms it. Reload this page in a minute.
    </StateMessage>
  );
}
