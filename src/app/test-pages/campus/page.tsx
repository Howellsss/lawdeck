import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CampusForm } from "@/components/account/CampusForm";
import { testPagesEnabled } from "../sample";

// Campus choice test only (tests/voice/campus.spec.ts): the compact form and the Account page
// form with the draft campus list, to check the layout on phones and desktops.
// "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
const campuses = [
  { key: "abuja", name: "Abuja", kind: "campus" as const },
  { key: "lagos", name: "Lagos", kind: "campus" as const },
  { key: "port-harcourt", name: "Port Harcourt", kind: "campus" as const },
  { key: "aspirant", name: "Law School aspirant", kind: "aspirant" as const },
];

export default function TestCampusPage() {
  return (
    <Suspense fallback={null}>
      <TestCampus />
    </Suspense>
  );
}

async function TestCampus() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <section aria-label="Your campus" className="w-full max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3">
        <CampusForm campuses={campuses} campus={null} compact />
      </section>
      <section aria-label="Account" className="flex flex-col gap-3 border-t border-line pt-6">
        <CampusForm campuses={campuses} campus="lagos" />
      </section>
    </div>
  );
}
