import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { RevisionRound } from "@/components/study/RevisionRound";
import { testPagesEnabled } from "../sample";

// Memory challenge test only (tests/voice/revise.spec.ts): made-up questions, not legal content,
// to check the look on phones and desktops. "Not found" unless LAWDECK_TEST_PAGES=1.
export default function TestRevisePage() {
  return (
    <Suspense fallback={null}>
      <TestRevise />
    </Suspense>
  );
}

async function TestRevise() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Yesterday, you studied Wombat summons.</h1>
      <RevisionRound
        questions={[
          {
            id: "00000000-0000-4000-8000-000000000401",
            placement: "reading",
            afterSection: 0,
            kind: "mcq",
            prompt: "Which made-up case settled when a wombat summons is used?",
            choices: ["Wombat v Quokka", "Kangaroo v Emu", "Possum v Koala"],
            keyPoint: "wombat summons authority",
            topicId: "00000000-0000-4000-8000-000000000402",
            topicName: "Wombat summons",
          },
          {
            id: "00000000-0000-4000-8000-000000000403",
            placement: "test",
            afterSection: 0,
            kind: "short",
            prompt: "In one line, when will the court refuse to decide on affidavits alone?",
            choices: null,
            keyPoint: "disputed facts",
            topicId: "00000000-0000-4000-8000-000000000402",
            topicName: "Wombat summons",
          },
        ]}
      />
    </div>
  );
}
