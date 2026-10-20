import { Composer } from "@/components/learn/Composer";
import { Greeting } from "@/components/learn/Greeting";
import { BrandMark } from "@/components/ui/BrandMark";

// Home: calm and input-first (PRD 4.2). On phones the composer sits at the bottom, as in the M2 design.
export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col px-4 pb-5 lg:justify-center lg:pb-28">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center lg:flex-none lg:flex-row lg:pb-8">
        <BrandMark size={52} priority />
        <h1 className="font-serif text-4xl font-normal tracking-tight text-greeting lg:text-[46px]">
          <Greeting />
        </h1>
      </div>
      <div className="flex justify-center">
        <Composer />
      </div>
    </div>
  );
}
