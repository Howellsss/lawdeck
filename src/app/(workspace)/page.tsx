import { Suspense } from "react";
import { Composer } from "@/components/learn/Composer";
import { Greeting } from "@/components/learn/Greeting";
import { NamedGreeting } from "@/components/learn/NamedGreeting";
import { NamePrompt } from "@/components/learn/NamePrompt";
import { QuestionAllowance } from "@/components/learn/QuestionAllowance";
import { PilotHomeCard } from "@/components/pilot/PilotHomeCard";
import { BrandMark } from "@/components/ui/BrandMark";
import { speechConfigured } from "@/server/ai/speech";

// Home: calm and input-first (PRD 4.2). On phones the composer sits at the bottom, as in the M2 design.
export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col px-4 pb-5 lg:justify-center lg:pb-28">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center lg:flex-none lg:flex-row lg:pb-8">
        <BrandMark size={44} priority />
        <h1 className="max-w-full text-balance break-words font-serif text-[30px] font-normal leading-tight tracking-tight text-greeting sm:text-4xl lg:text-[46px]">
          {/* The page shell is pre-built; the name arrives with the signed-in check. */}
          <Suspense fallback={<Greeting />}>
            <NamedGreeting />
          </Suspense>
        </h1>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Composer voice={speechConfigured()} />
        <Suspense fallback={null}>
          <QuestionAllowance />
        </Suspense>
        <Suspense fallback={null}>
          <PilotHomeCard />
        </Suspense>
        <Suspense fallback={null}>
          <NamePrompt />
        </Suspense>
      </div>
    </div>
  );
}
