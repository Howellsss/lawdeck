"use client";

import { useState } from "react";
import { HighlightFrame } from "@/components/lessons/HighlightFrame";
import { LessonBody } from "@/components/lessons/LessonBody";
import { authorityKeysInSection, partsToRead, readingState, type SectionTick as Tick } from "@/lib/readInFull";
import type { LessonContent } from "@/schemas/lesson";
import type { Authority, Checkpoint } from "@/server/db/lessons";
import { FinishReading } from "./FinishReading";
import { SectionEvidence } from "./SectionEvidence";
import { SectionTick } from "./SectionTick";

// One lesson read in full (skim, tick and approve): each section with what to check under it and
// its tick, then approve or send back. Ticks are saved as they are made.
export function ReadInFull({
  lessonId,
  version,
  content,
  checkpoints,
  authorities,
  initialTicks,
  nextHref,
}: {
  lessonId: string;
  version: number;
  content: LessonContent;
  checkpoints: Checkpoint[];
  authorities: Authority[];
  initialTicks: Tick[];
  nextHref: string | null;
}) {
  const [ticks, setTicks] = useState<Tick[]>(initialTicks);
  const test = checkpoints.filter((c) => c.placement === "test");
  const testPart = content.sections.length;
  const state = readingState(partsToRead(content.sections.length, test.length), ticks);
  const setTick = (section: number) => (tick: Tick | undefined) =>
    setTicks((list) => [...list.filter((t) => t.section !== section), ...(tick ? [tick] : [])]);
  const byKey = new Map(authorities.map((a) => [a.key, a]));

  return (
    <div className="flex flex-col gap-6">
      <p className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-2 text-sm backdrop-blur" aria-live="polite">
        {state.checked + state.problems.length} of {state.sections} ticked
        {state.problems.length ? <span className="text-warning"> · {state.problems.length} problem{state.problems.length === 1 ? "" : "s"}</span> : ""}
      </p>
      <HighlightFrame>
        <LessonBody
          content={content}
          after={(index) => (
            <div className="flex flex-col gap-3">
              <SectionEvidence
                authorities={authorityKeysInSection(content, index)
                  .map((k) => byKey.get(k))
                  .filter((a): a is Authority => Boolean(a))}
                questions={checkpoints.filter((c) => c.placement === "reading" && c.after_section === index)}
              />
              <SectionTick
                lessonId={lessonId}
                version={version}
                section={index}
                tick={ticks.find((t) => t.section === index)}
                label={`Section ${index + 1}`}
                onChange={setTick(index)}
              />
            </div>
          )}
        />
      </HighlightFrame>
      {test.length > 0 && (
        <section aria-labelledby="read-test" className="flex flex-col gap-3">
          <h2 id="read-test" className="font-serif text-2xl font-normal">
            End-of-topic test ({test.length} question{test.length === 1 ? "" : "s"})
          </h2>
          <SectionEvidence authorities={[]} questions={test} />
          <SectionTick
            lessonId={lessonId}
            version={version}
            section={testPart}
            label="The test"
            tick={ticks.find((t) => t.section === testPart)}
            onChange={setTick(testPart)}
          />
        </section>
      )}
      <FinishReading lessonId={lessonId} version={version} state={state} nextHref={nextHref} sectionCount={content.sections.length} />
    </div>
  );
}
