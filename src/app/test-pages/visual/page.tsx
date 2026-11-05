import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { testPagesEnabled } from "../sample";
import { Visual } from "./Visual";

// Visual Revision Mode (tests/voice/visualRevision.spec.ts): made-up text, not legal content.
// "Not found" unless LAWDECK_TEST_PAGES=1.
export default function TestVisualPage() {
  return (
    <Suspense fallback={null}>
      <TestVisual />
    </Suspense>
  );
}

async function TestVisual() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Revise visually: Wombat summons</h1>
      <Visual />
    </div>
  );
}
