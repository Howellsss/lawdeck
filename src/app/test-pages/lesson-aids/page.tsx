import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SavedAids } from "@/components/study/SavedAids";
import { SectionExtras } from "@/components/study/SectionExtras";
import { testPagesEnabled } from "../sample";

// Memory aids and stories as students see them (tests/voice/lessonAids.spec.ts): made-up law about
// made-up places, not legal content. "Not found" unless LAWDECK_TEST_PAGES=1.
const id = (n: number) => `00000000-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`;

export default function TestLessonAidsPage() {
  return (
    <Suspense fallback={null}>
      <TestLessonAids />
    </Suspense>
  );
}

async function TestLessonAids() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Wombat licences</h1>
      <SavedAids
        aids={[{ savedId: id(1), aidId: null, madeForMe: false, kind: "phrase", title: "Made-up stages", device: "File, inspect, decide", items: [{ key: "File", meaning: "At the registry" }], explanation: null }]}
      />
      <SectionExtras
        index={0}
        authorityNames={new Map([["quokka-v-numbat", "Quokka v Numbat Licensing Board"]])}
        aids={[
          {
            id: id(2),
            afterSection: 0,
            kind: "acronym",
            title: "Made-up licence conditions",
            device: "RWFOI",
            items: [
              { key: "R", meaning: "Resident in Wombat State" },
              { key: "W", meaning: "Written application" },
              { key: "F", meaning: "Fee paid" },
              { key: "O", meaning: "No previous offence" },
              { key: "I", meaning: "Inspection" },
            ],
            explanation: "All five are needed.",
            saved: false,
          },
        ]}
        stories={[
          {
            id: id(3),
            afterSection: 0,
            kind: "everyday",
            title: "Chidi's poultry licence",
            authorityKey: null,
            parts: [{ heading: "What happened", text: "Chidi in Ibadan paid ₦50,000 but no officer came to inspect his made-up farm." }],
            takeaway: "No inspection, no valid licence.",
            question: "Is Chidi's made-up licence valid?",
            choices: ["Yes", "No"],
          },
          {
            id: id(4),
            afterSection: 0,
            kind: "case",
            title: "The farm that was never inspected",
            authorityKey: "quokka-v-numbat",
            parts: [{ heading: "The decision", text: "A made-up court held the made-up licence void." }],
            takeaway: "Inspection is a condition of validity.",
            question: null,
            choices: null,
          },
        ]}
      />
    </div>
  );
}
