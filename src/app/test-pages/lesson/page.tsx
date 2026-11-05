import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HighlightFrame } from "@/components/lessons/HighlightFrame";
import { LessonBody } from "@/components/lessons/LessonBody";
import { RecallCard } from "@/components/study/RecallCard";
import { placeMarks } from "@/lib/lessonMarks";
import type { LessonContent } from "@/schemas/lesson";
import { testPagesEnabled } from "../sample";

// Lesson test only (tests/e2e/workspace.spec.ts): a made-up lesson with highlights and a recall
// question, to check the look on phones and desktops in both themes. Made-up names, not legal
// content. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
const p1 = "A wombat summons suits questions of construction. The court will not decide disputed facts on affidavits alone. This was settled in Wombat v Quokka. The procedure is in Order 3 rule 5.";
const p2 = "Where the facts turn out to be disputed, the court may order the matter to continue with pleadings. Remember to say why the facts are not in dispute.";
const content: LessonContent = {
  sections: [
    {
      heading: "When to use a wombat summons",
      paragraphs: [
        {
          text: p1,
          sources: [1],
          marks: placeMarks(p1, [
            { type: "definition", phrase: "wombat summons" },
            { type: "principle", phrase: "will not decide disputed facts on affidavits alone" },
            { type: "case", phrase: "Wombat v Quokka", authority: "wombat-v-quokka" },
            { type: "statute", phrase: "Order 3 rule 5" },
          ], new Set(["wombat-v-quokka"])),
        },
        {
          text: p2,
          sources: [1],
          marks: placeMarks(p2, [
            { type: "exception", phrase: "Where the facts turn out to be disputed" },
            { type: "tip", phrase: "Remember to say why the facts are not in dispute" },
          ]),
        },
      ],
    },
  ],
  sources: [{ label: 1, passageId: "00000000-0000-4000-8000-000000000301", title: "Made-up notes", heading: null, pages: "p. 1" }],
};

export default function TestLessonPage() {
  return (
    <Suspense fallback={null}>
      <TestLesson />
    </Suspense>
  );
}

async function TestLesson() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Wombat summons</h1>
      <HighlightFrame>
        <LessonBody content={content} />
      </HighlightFrame>
      <RecallCard
        checkpoint={{
          id: "00000000-0000-4000-8000-000000000302",
          placement: "reading",
          afterSection: 0,
          kind: "mcq",
          prompt: "Which made-up case settled when a wombat summons is used?",
          choices: ["Wombat v Quokka", "Kangaroo v Emu", "Possum v Koala"],
          keyPoint: "wombat summons authority",
        }}
        sessionId={null}
        context="reading"
      />
    </div>
  );
}
