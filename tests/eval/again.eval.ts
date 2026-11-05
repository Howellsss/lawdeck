// The "on request" test (docs/specs/remembrance.md, Phase 2c): on the made-up lesson, "Another
// memory aid" for the five conditions and "Tell it another way" for an everyday and a case story,
// written by Sonnet with the real instructions, then checked: the new aid keeps all five
// conditions (Lawdeck's own rule too); the everyday story is set in Nigeria; the case story stays
// with the same case and adds no number the library does not give; no case outside the lesson.
// About 3 cents a run. Needs ANTHROPIC_API_KEY. Only results are printed, never the text.
import { appendFileSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keepsAllPoints, sameStory } from "@/lib/againRules";
import { AID_AGAIN_SYSTEM, aidAgainRequest, STORY_AGAIN_SYSTEM, storyAgainRequest } from "@/prompts/again";
import type { ExtrasLesson } from "@/prompts/extras";
import { writeAgain } from "@/server/ai/again";

const fixture = JSON.parse(readFileSync("tests/eval/extras/lesson.json", "utf8")) as { lesson: ExtrasLesson; elements: string[] };
const CASE_NAME = /\b([A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*)*)\s+v\.?\s+([A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*)*)/g;
const NIGERIA = /₦|naira|Lagos|Abuja|Kano|Ibadan|Enugu|Port Harcourt|Nigeria|Kaduna|Jos|Benin/i;
const known = fixture.lesson.authorities.filter((a) => a.kind === "case").map((a) => a.name);
const facts = fixture.lesson.authorities.map((a) => [a.facts, a.decision, a.issue].join(" ")).join(" ") + JSON.stringify(fixture.lesson.sections);

const original = {
  afterSection: 0,
  kind: "phrase",
  title: "Conditions for a valid wombat licence",
  device: "Real wombats fear old inspectors",
  items: [
    { key: "Real", meaning: "Resident in Wombat State" },
    { key: "wombats", meaning: "Written application" },
    { key: "fear", meaning: "Fee paid (not for registered charities)" },
    { key: "old", meaning: "No previous wombat offence" },
    { key: "inspectors", meaning: "Inspection of the premises" },
  ],
};
const everyday = {
  afterSection: 2,
  kind: "everyday",
  title: "Tunde's farm licence",
  authorityKey: "quokka-v-numbat-licensing-board",
  parts: [{ heading: "What happened", text: "Tunde in Ibadan paid ₦40,000 for a made-up licence, but no officer ever came to inspect his farm." }],
  takeaway: "No inspection, no valid licence.",
};
const caseStory = {
  afterSection: 2,
  kind: "case",
  title: "The farm that was never inspected",
  authorityKey: "quokka-v-numbat-licensing-board",
  parts: [{ heading: "What happened", text: "Quokka was granted a licence without any inspection; the Board later revoked it." }],
  takeaway: "Inspection is a condition of validity.",
};

describe("on request test", () => {
  it("makes another memory aid and tells stories another way as Lawdeck promises", async () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY to run the on request test.");
    const [aid, retold, retoldCase] = await Promise.all([
      writeAgain("aid", AID_AGAIN_SYSTEM, aidAgainRequest(fixture.lesson, original)),
      writeAgain("story", STORY_AGAIN_SYSTEM, storyAgainRequest(fixture.lesson, everyday)),
      writeAgain("story", STORY_AGAIN_SYSTEM, storyAgainRequest(fixture.lesson, caseStory)),
    ]);
    if (!aid.ok || !retold.ok || !retoldCase.ok) {
      throw new Error(`Claude did not answer: ${[aid, retold, retoldCase].map((r) => (r.ok ? "ok" : r.reason)).join(", ")}`);
    }
    const newAid = aid.reply.memory_aids[0];
    const story = retold.reply.stories[0];
    const story2 = retoldCase.reply.stories[0];
    const aidText = newAid ? [newAid.device, ...newAid.items.map((i) => i.meaning)].join(" ").toLowerCase() : "";
    const text = (s: typeof story) => (s ? [s.title, s.takeaway, ...s.parts.map((p) => p.text)].join(" ") : "");
    const all = [aidText, text(story), text(story2)].join("\n");
    const unknown = [...all.matchAll(CASE_NAME)].map((m) => m[0]).filter((n) => !known.some((k) => k.includes(n) || n.includes(k)));
    const caseNumbers = [...text(story2).matchAll(/\d+/g)].map((m) => m[0]);
    const seconds = Math.max(aid.ms, retold.ms, retoldCase.ms) / 1000;

    const checks: [string, boolean][] = [
      ["another aid was made", Boolean(newAid) && aid.reply.found],
      ["it keeps exactly the same number of points (Lawdeck's rule)", Boolean(newAid) && keepsAllPoints(original, newAid!)],
      ["all five conditions are in it", fixture.elements.every((e) => aidText.includes(e))],
      ["it is a different device", Boolean(newAid) && newAid!.device.trim().toLowerCase() !== original.device.toLowerCase()],
      ["the everyday story stays an everyday story", Boolean(story) && sameStory(everyday, story!)],
      ["it is set in Nigeria", NIGERIA.test(text(story))],
      ["the case story stays with the same case", Boolean(story2) && sameStory(caseStory, story2!)],
      [`the case story adds no number the library does not give (${caseNumbers.join(", ") || "none"})`, caseNumbers.every((n) => facts.includes(n))],
      [`no case named outside the lesson (${unknown.join("; ") || "none"})`, unknown.length === 0],
      [`each back within 45 seconds (${seconds.toFixed(0)} s)`, seconds <= 45],
    ];
    const cost = [aid, retold, retoldCase].reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
    const summary = [`## On request test`, `Model ${aid.model}; cost US$${cost.toFixed(3)}.`, "", ...checks.map(([l, ok]) => `${ok ? "✅" : "❌"} ${l}`)].join("\n");
    console.info(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
    expect(checks.filter(([, ok]) => !ok).map(([l]) => l)).toEqual([]);
  });
});
