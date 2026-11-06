import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReadInFull } from "@/components/lessons/read/ReadInFull";
import { placeMarks } from "@/lib/lessonMarks";
import type { LessonContent } from "@/schemas/lesson";
import type { Authority, Checkpoint } from "@/server/db/lessons";
import { testPagesEnabled } from "../sample";

// Read in full test only (tests/voice/read-in-full.spec.ts): a made-up two-section lesson with one
// section already checked, to check the layout on phones and desktops. Made-up names, not legal
// content. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
const p1 = "A wombat summons suits questions of construction. This was settled in Wombat v Quokka.";
const p2 = "Where the facts are disputed, the matter continues with pleadings under Order 3 rule 5.";
const lessonId = "00000000-0000-4000-8000-000000000701";
const content: LessonContent = {
  sections: [
    {
      heading: "When to use a wombat summons",
      paragraphs: [
        {
          text: p1,
          sources: [1],
          marks: placeMarks(p1, [{ type: "case", phrase: "Wombat v Quokka", authority: "wombat-v-quokka" }], new Set(["wombat-v-quokka"])),
        },
      ],
    },
    { heading: "Disputed facts", paragraphs: [{ text: p2, sources: [1], marks: placeMarks(p2, [{ type: "statute", phrase: "Order 3 rule 5" }]) }] },
  ],
  sources: [{ label: 1, passageId: "00000000-0000-4000-8000-000000000301", title: "Made-up notes", heading: null, pages: "p. 1" }],
};
const question = (n: number, placement: "reading" | "test", after: number): Checkpoint => ({
  id: `00000000-0000-4000-8000-00000000071${n}`,
  lesson_id: lessonId,
  position: n,
  after_section: after,
  placement,
  kind: "short",
  prompt: placement === "test" ? "When does a wombat summons not suit?" : "What does a wombat summons suit?",
  choices: null,
  correct_choice: null,
  answer: placement === "test" ? "When the facts are disputed." : "Questions of construction.",
  explanation: null,
  key_point: "use",
  sources: [],
});
const authorities: Authority[] = [
  {
    id: "00000000-0000-4000-8000-000000000721",
    lesson_id: lessonId,
    key: "wombat-v-quokka",
    kind: "case",
    name: "Wombat v Quokka",
    citation: "(2001) 1 MWLR 1",
    court: null,
    facts: null,
    issue: null,
    decision: null,
    principle: "Disputed facts are not decided on affidavits alone.",
    facts_from_library: false,
    sources: [],
  },
];

export default function TestReadInFullPage() {
  return (
    <Suspense fallback={null}>
      <TestReadInFull />
    </Suspense>
  );
}

async function TestReadInFull() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Wombat summons</h1>
      <ReadInFull
        lessonId={lessonId}
        version={1}
        content={content}
        checkpoints={[question(1, "reading", 0), question(2, "test", 1)]}
        authorities={authorities}
        initialTicks={[{ section: 0, verdict: "checked", note: null }]}
        nextHref="/test-pages/read-in-full?next=1"
      />
    </div>
  );
}
