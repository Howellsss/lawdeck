import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InviteCreateForm } from "@/components/pilot/InviteCreateForm";
import { InviteLinkCopy } from "@/components/pilot/InviteLinkCopy";
import { InviteList } from "@/components/pilot/InviteList";
import { PilotSettingsForm } from "@/components/pilot/PilotSettingsForm";
import { RegisteredEmailForm } from "@/components/pilot/RegisteredEmailForm";
import { RegisteredEmailList } from "@/components/pilot/RegisteredEmailList";
import { UsageLimitsForm } from "@/components/pilot/UsageLimitsForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { getPilotDashboard } from "@/server/db/pilot";

export const metadata: Metadata = { title: "Pilot · Lawdeck" };

// The closed pilot's tools (Phase 8), for admins only: registered emails, invite codes, the
// invite-only and price-question settings, and limits. The weekly measures moved to the Users
// dashboard (founder, 2026-10-31). Everyone else gets "page not found".
export default function PilotPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8">
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
        <p className="text-muted">
          The pilot&apos;s tools: registered emails, invite codes, settings and limits. Student numbers, usage and costs are all on{" "}
          <Link href="/admin/users">Users</Link>.
        </p>
      </div>
      <section aria-labelledby="emails-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="emails-heading" className="text-lg font-medium">Registered emails</h2>
        <p className="text-sm text-muted">
          Register each tester’s email, then send them the invite link. When they continue with Google using a registered email,
          they are in. Anyone else who opens the link is told their email is not registered. Works while Invite only is ticked
          below.
        </p>
        {data.emails === null ? (
          <p role="alert" className="text-sm text-warning">
            Registered emails need database update 36 first. Paste it into Supabase, then reload this page.
          </p>
        ) : (
          <>
            <InviteLinkCopy />
            <RegisteredEmailForm />
            <RegisteredEmailList emails={data.emails} />
          </>
        )}
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
      <section aria-labelledby="limits-heading" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="limits-heading" className="text-lg font-medium">Limits for a public test</h2>
        <p className="text-sm text-muted">
          Each student gets a few questions at a time and a set number a month, so the AI credit can’t run out. Questions include
          practice, briefs, marking and drafts. Leave a box empty for no extra limit. Reviewers and admins are never limited.
        </p>
        <UsageLimitsForm initial={data.limits} />
      </section>
    </>
  );
}
