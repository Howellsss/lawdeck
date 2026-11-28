import Link from "next/link";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { trialBannerText, trialStatus } from "@/lib/trial";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getAllowance } from "@/server/learn/allowance";

// The free-trial line at the top of every workspace page (founder, 2026-11-28): days and credits
// left while the trial runs; a clear "choose a plan" once it ends. Nothing for paying students,
// staff or visitors. The server still enforces the limits whatever this shows.
export async function TrialBanner() {
  if (!(await getCurrentAccount())) return null;
  const allowance = await getAllowance(await createSupabaseServerClient());
  // Read once per request, after the sign-in check.
  const trial = trialStatus(allowance, new Date());
  if (!trial) return null;
  const urgent = trial.state !== "active";
  return (
    <div
      role={urgent ? "status" : undefined}
      className={`flex flex-col gap-3 border-b px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8 ${
        urgent ? "border-warning" : "border-line"
      }`}
    >
      <p className={urgent ? "text-warning" : "text-muted"}>{trialBannerText(trial)}</p>
      {urgent ? (
        <Link href="/plans" className={`${compactPrimaryButton} self-start sm:self-auto`}>
          Choose a plan
        </Link>
      ) : (
        <Link href="/plans" className="shrink-0 underline">
          See plans
        </Link>
      )}
    </div>
  );
}
