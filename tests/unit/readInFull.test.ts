import { describe, expect, it } from "vitest";
import { authorityKeysInSection, needsReading, partsToRead, readingState, sendBackNote } from "@/lib/readInFull";
import type { LessonContent } from "@/schemas/lesson";

const content: LessonContent = {
  sections: [
    {
      heading: "One",
      paragraphs: [
        {
          text: "Wombat v Quokka and Numbat v Bilby",
          sources: [1],
          marks: [
            { type: "case", start: 0, end: 15, authority: "wombat" },
            { type: "case", start: 20, end: 34, authority: "numbat" },
          ],
        },
        { text: "Wombat again", sources: [1], marks: [{ type: "case", start: 0, end: 6, authority: "wombat" }] },
      ],
    },
    { heading: "Two", paragraphs: [{ text: "Plain", sources: [1], marks: [] }] },
  ],
  sources: [{ label: 1, passageId: "00000000-0000-4000-8000-000000000301", title: "Made-up", heading: null, pages: null }],
};

describe("reading a lesson in full", () => {
  it("counts the end-of-topic test as one more item only when it has questions", () => {
    expect(partsToRead(2, 0)).toBe(2);
    expect(partsToRead(2, 5)).toBe(3);
  });

  it("approves only when every item is checked and none is a problem", () => {
    expect(readingState(3, [{ section: 0, verdict: "checked", note: null }])).toMatchObject({ checked: 1, missing: [1, 2], canApprove: false, canSendBack: false });
    const all = [0, 1, 2].map((section) => ({ section, verdict: "checked" as const, note: null }));
    expect(readingState(3, all).canApprove).toBe(true);
    const oneProblem = [...all.slice(0, 2), { section: 2, verdict: "problem" as const, note: "Wrong rule" }];
    expect(readingState(3, oneProblem)).toMatchObject({ canApprove: false, canSendBack: true });
  });

  it("ignores ticks for sections that no longer exist, and never approves an empty lesson", () => {
    expect(readingState(1, [{ section: 0, verdict: "checked", note: null }, { section: 4, verdict: "problem", note: "old" }])).toMatchObject({
      canApprove: true,
      problems: [],
    });
    expect(readingState(0, []).canApprove).toBe(false);
  });

  it("sends back each problem with its section heading, the test named as such", () => {
    expect(
      sendBackNote(content, [
        { section: 1, verdict: "problem", note: "Missing the exception" },
        { section: 2, verdict: "problem", note: "Answer B is wrong" },
      ]),
    ).toBe("Two: Missing the exception\nEnd-of-topic test: Answer B is wrong");
  });

  it("lists the cases and statutes a section names, once each", () => {
    expect(authorityKeysInSection(content, 0)).toEqual(["wombat", "numbat"]);
    expect(authorityKeysInSection(content, 1)).toEqual([]);
  });

  it("needs reading when awaiting review or approved with its course", () => {
    expect(needsReading({ status: "pending", bulk_approved: false })).toBe(true);
    expect(needsReading({ status: "approved", bulk_approved: true })).toBe(true);
    expect(needsReading({ status: "approved", bulk_approved: false })).toBe(false);
    expect(needsReading({ status: "rejected", bulk_approved: false })).toBe(false);
  });
});
