import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VoiceTestForm } from "@/components/voice/VoiceTestForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { PRONUNCIATIONS } from "@/lib/pronunciations";
import { speechConfigured, SPEECH_DAILY_CHARS } from "@/server/ai/speech";
import { getStaffRole } from "@/server/auth/roles";

export const metadata: Metadata = { title: "Voice test · Lawdeck" };

// Reviewers and admins only: hear how Lawdeck's voice says names, and see the pronunciation list.
export default function VoiceTestPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the voice test" />}>
        <VoiceTest />
      </Suspense>
    </div>
  );
}

async function VoiceTest() {
  if (!(await getStaffRole())) notFound();
  const configured = speechConfigured();
  return (
    <>
      <h1 className="font-serif text-3xl font-normal text-greeting">Voice test</h1>
      <p className="text-muted">
        Lawdeck reads answers aloud in the voice each student picks: British, American or Nigerian English,
        female or male. Type a name or a sentence and pick a voice to hear how it is said. If a name sounds wrong, tell the Lawdeck team how it should sound and it will be added to the
        pronunciation list below.
      </p>
      {configured ? (
        <VoiceTestForm />
      ) : (
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-warning">
          Reading aloud is not switched on yet: the Azure Speech key and region need adding on Vercel.
        </p>
      )}
      <p className="text-sm text-muted">
        Each student can hear up to {SPEECH_DAILY_CHARS.toLocaleString("en-GB")} characters a day (about ten long
        answers). Reviewers and admins are not limited.
      </p>
      <section aria-labelledby="names" className="flex flex-col gap-3">
        <h2 id="names" className="font-serif text-2xl font-normal">
          Pronunciation list ({PRONUNCIATIONS.length})
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {PRONUNCIATIONS.map((entry) => (
            <li key={entry.name} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-[15px]">
              <span className="font-medium">{entry.name}</span>
              <span className="text-muted">said as “{entry.say}”</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
