// The memory aids test (docs/specs/remembrance.md, Phase 2): a made-up lesson (made-up law about
// made-up places), written into memory aids and stories by Opus with the real prompt, then checked
// for what Lawdeck promises: an aid for the five conditions with none left out; every acronym
// spelled by its items; a case story only for the case whose facts the library gives, with no
// number or name it does not give; no authority outside the lesson; at least one everyday story;
// and Lawdeck's own limits. About 10–20 cents a run. Needs ANTHROPIC_API_KEY. Only results are
// printed, never the text.
import { appendFileSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { acronymMatches, MAX_AIDS, MAX_STORIES, selectAids, selectStories } from "@/lib/extrasRules";
import type { ExplainPassage } from "@/prompts/explain";
import type { ExtrasLesson } from "@/prompts/extras";
import { writeExtras } from "@/server/ai/extras";

const fixture = JSON.parse(readFileSync("tests/eval/extras/lesson.json", "utf8")) as {
  lesson: ExtrasLesson;
  passages: ExplainPassage[];
  elements: string[];
};
// "X v Y" case names in the written text.
const CASE_NAME = /\b([A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*)*)\s+v\.?\s+([A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*)*)/g;

describe("memory aids test", () => {
  it("writes memory aids and stories as Lawdeck promises", async () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY to run the memory aids test.");
    const started = Date.now();
    const result = await writeExtras(fixture.lesson, fixture.passages);
    const seconds = (Date.now() - started) / 1000;
    if (!result.ok) throw new Error(`Claude did not write memory aids: ${result.reason}`);
    const { memory_aids: aids, stories } = result.reply;

    const aidText = (a: (typeof aids)[number]) => [a.title, a.device, a.explanation, ...a.items.map((i) => `${i.key} ${i.meaning}`)].join(" ");
    const storyText = (s: (typeof stories)[number]) => [s.title, s.takeaway, s.question, s.explanation, ...s.parts.map((p) => p.text), ...s.choices].join(" ");
    const allText = [...aids.map(aidText), ...stories.map(storyText)].join("\n");
    const knownCases = fixture.lesson.authorities.filter((a) => a.kind === "case").map((a) => a.name);
    const namedCases = [...allText.matchAll(CASE_NAME)].map((m) => m[0]);
    const unknownCases = namedCases.filter((name) => !knownCases.some((known) => known.includes(name) || name.includes(known)));

    const conditions = aids.find((a) => a.after_section === 0);
    const conditionsText = conditions ? aidText(conditions).toLowerCase() : "";
    const acronyms = aids.filter((a) => a.kind === "acronym");
    const caseStories = stories.filter((s) => s.kind === "case");
    const facts = fixture.lesson.authorities.map((a) => [a.facts, a.decision, a.issue].join(" ")).join(" ") + fixture.passages.map((p) => p.text).join(" ");
    const caseNumbers = caseStories.flatMap((s) => [...storyText(s).matchAll(/\d+/g)].map((m) => m[0]));
    const last = fixture.lesson.sections.length - 1;
    const kept = {
      aids: selectAids(aids, last).kept.length,
      stories: selectStories(stories, last, fixture.lesson.authorities).kept.length,
    };

    const checks: [string, boolean][] = [
      ["found something to help with", result.reply.found],
      [`an aid for the five conditions (section 1)`, Boolean(conditions)],
      [`all five conditions in it, none left out`, fixture.elements.every((e) => conditionsText.includes(e))],
      [`every acronym spelled by its items (${acronyms.length} acronyms)`, acronyms.every(acronymMatches)],
      [`at most one aid per section`, new Set(aids.map((a) => a.after_section)).size === aids.length],
      [`case stories only for the case with library facts`, caseStories.every((s) => s.authority === "quokka-v-numbat-licensing-board")],
      [`no case story for Emu v Koala (no facts in the library)`, !caseStories.some((s) => s.authority === "emu-v-koala" || storyText(s).includes("Emu v Koala") && s.authority !== "quokka-v-numbat-licensing-board")],
      [`case stories add no number the library does not give (${caseNumbers.join(", ") || "none"})`, caseNumbers.every((n) => facts.includes(n))],
      [`no case named outside the lesson (${unknownCases.join("; ") || "none"})`, unknownCases.length === 0],
      [`at least one everyday story`, stories.some((s) => s.kind === "everyday")],
      [`everyday stories use naira or a Nigerian setting`, stories.filter((s) => s.kind === "everyday").every((s) => /₦|naira|Lagos|Abuja|Kano|Ibadan|Enugu|Port Harcourt|Nigeria/i.test(storyText(s)))],
      [`Lawdeck's limits leave at most ${MAX_AIDS} aids and ${MAX_STORIES} stories (${kept.aids} and ${kept.stories})`, kept.aids <= MAX_AIDS && kept.stories <= MAX_STORIES],
      [`back within 4 minutes (${seconds.toFixed(0)} s)`, seconds <= 240],
    ];
    const lines = checks.map(([label, ok]) => `${ok ? "✅" : "❌"} ${label}`);
    const summary = [
      `## Memory aids test`,
      `${aids.length} memory aids (${aids.map((a) => a.kind).join(", ")}), ${stories.length} stories (${stories.map((s) => s.kind).join(", ")}); model ${result.model}; cost US$${result.costUsd?.toFixed(3) ?? "?"}.`,
      "",
      ...lines,
    ].join("\n");
    console.info(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
    expect(checks.filter(([, ok]) => !ok).map(([label]) => label)).toEqual([]);
  });
});
