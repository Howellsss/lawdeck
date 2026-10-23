import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InviteCreateForm } from "@/components/pilot/InviteCreateForm";
import { InviteList } from "@/components/pilot/InviteList";
import { PilotMeasures } from "@/components/pilot/PilotMeasures";
import { PilotSettingsForm } from "@/components/pilot/PilotSettingsForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getPilotDashboard } from "@/server/db/pilot";

export const metadata: Metadata = { title: "Pilot · Lawdeck" };

// The closed pilot (Phase 8), for admins only: the weekly review and measures, invite codes, and the
// invite-only and price-question settings. Everyone else gets "page not found".
export default function PilotPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading the pilot" />}>
        <Pilot />
      </Suspense>
    </div>
  );
}

async function Pilot() {
  const data = await getPilotDashboard();
  if (!data) notFound();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Pilot</h1>
        <p className="text-muted">The weekly review: how the pilot is going, what it costs, and what students say. Counts only, never names.</p>
      </div>
      <section aria-labelledby="measures-heading" className="flex flex-col gap-3">
        <h2 id="measures-heading" className="text-lg font-medium">This week and the last 6 weeks</h2>
        <PilotMeasures data={data} />
      </section>
      <section aria-labelledby="invites-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="invites-heading" className="text-lg font-medium">Invite codes</h2>
        <p className="text-sm text-muted">Create a code for each group, then send it to the students. They enter it on their Account page.</p>
        <InviteCreateForm />
        <InviteList codes={data.codes} />
      </section>
      <section aria-labelledby="settings-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="settings-heading" className="text-lg font-medium">Settings</h2>
        <PilotSettingsForm initial={data.settings} />
      </section>
    </>
  );
}
