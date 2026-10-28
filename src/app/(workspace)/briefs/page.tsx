import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewBriefForm } from "@/components/briefs/NewBriefForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { listBriefs } from "@/server/db/briefs";

export const metadata: Metadata = { title: "Briefs · Lawdeck" };

// Case and statute briefs (PRD LN-09): ask for a new one, and see the student's saved briefs.
export default function BriefsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">Briefs</h1>
      <Suspense fallback={<LoadingRows label="Loading your briefs" />}>
        <Briefs />
      </Suspense>
    </div>
  );
}

async function Briefs() {
  const result = await listBriefs();
  if (result.status === "signed-out") return <SignInPrompt what="briefs" returnTo="/briefs" />;
  return (
    <>
      <p className="text-muted">
        Facts, issues, decision, ratio and relevance for a case; purpose, key sections and relevance for a statute, from approved
        course material.
      </p>
      <NewBriefForm />
      <h2 className="text-lg font-medium">Your briefs</h2>
      {result.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">No briefs yet. Your briefs will appear here.</p>
      ) : (
        <ul aria-label="Your briefs" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {result.data.map((brief) => (
            <li key={brief.id} className="flex flex-col gap-1 px-4 py-3">
              <Link href={`/briefs/${brief.id}`} className="break-words font-medium">
                {brief.name}
              </Link>
              <span className="text-sm text-muted">
                {brief.kind === "case" ? "Case" : "Statute"} · {formatWat(brief.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
