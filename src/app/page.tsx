import Image from "next/image";

// Placeholder home page for Phase 0. The real three-pane workspace arrives in Phase 1.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Image src="/brand/lawdeck-mark.png" alt="" width={48} height={48} priority />
        <h1 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
          Lawdeck is being built
        </h1>
      </div>
      <p className="max-w-md text-base text-muted">
        An AI study and drafting workspace for Nigerian Law School students.
      </p>
    </main>
  );
}
