import type { Metadata } from "next";
import { Suspense } from "react";
import { ProgressView } from "@/components/progress/ProgressView";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { getProgress } from "@/server/db/progress";

export const metadata: Metadata = { title: "My progress · Lawdeck" };

// My progress (docs/specs/remembrance.md, Phase 4b): how well each course and topic is remembered,
// from the student's own answers. No AI.
export default function ProgressPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">My progress</h1>
      <Suspense fallback={<LoadingRows label="Loading your progress" />}>
        <MyProgress />
      </Suspense>
    </div>
  );
}

async function MyProgress() {
  const result = await getProgress();
  if (result.status === "signed-out") return <SignInPrompt what="progress" returnTo="/progress" />;
  return <ProgressView progress={result.data} />;
}
