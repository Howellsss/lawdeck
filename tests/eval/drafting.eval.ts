// The drafting test (step 5d): one made-up document, drafted by Opus with the real prompt, checked
// for what Lawdeck promises (PRD DR-02, DR-04): every narrative part written within its limit;
// names and addresses only as stand-ins; a missing fact left as its stand-in, never invented; no
// case or statute named; no sum that was not given; and the draft back within 30 seconds.
// About 5 cents a run. Needs ANTHROPIC_API_KEY. Only results are printed, never the text.
import { appendFileSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factsFor, templateSpecSchema } from "@/schemas/drafting";
import { writeDraftParts } from "@/server/ai/draft";
import { factsForClaude } from "@/server/drafting/standIns";

const caseFile = JSON.parse(readFileSync("tests/eval/drafting/case.json", "utf8")) as {
  template: unknown;
  facts: Record<string, string | string[]>;
};
const AUTHORITY = /\b[A-Z][\w.'&-]*(?:\s+[A-Z][\w.'&-]*)*\s+v\.?\s+[A-Z]|\b(?:Act|Law|Rules|Decree|Constitution)\b|\b(?:Section|Order|Rule)\s+\d/;

describe("drafting test", () => {
  it("drafts the narrative parts as Lawdeck promises", async () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY to run the drafting test.");
    const spec = templateSpecSchema.parse(caseFile.template);
    const facts = factsFor(spec, caseFile.facts);
    if (!facts.ok) throw new Error(facts.message);
    const narrative = spec.parts.filter((part) => part.kind === "narrative");

    const started = Date.now();
    const result = await writeDraftParts({
      documentTitle: "Statement of claim (test)",
      forumName: "High Court of Wombat State",
      outline: spec.parts.map((part) => ({ id: part.id, heading: part.heading ?? null, kind: part.kind })),
      parts: narrative.map((part) => ({ id: part.id, heading: part.heading ?? null, instruction: part.instruction ?? "", maxWords: part.maxWords ?? 200 })),
      facts: factsForClaude(spec, facts.fields),
      userId: "drafting-test",
    });
    const seconds = (Date.now() - started) / 1000;
    if (!result.ok) throw new Error(`Claude did not draft: ${result.reason}`);

    const text = (id: string) => result.reply.parts.find((part) => part.id === id)?.text ?? "";
    const all = narrative.map((part) => text(part.id)).join("\n");
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    const realDetails = ["Adeyemi", "Okafor", "Bello"];
    const sums = [...all.matchAll(/(?:N|₦)\s?[\d,]+(?:\.\d+)?/g)].map((m) => m[0].replace(/\s/g, ""));

    const checks: [string, boolean][] = [
      ["every narrative part written", narrative.every((part) => text(part.id).trim().length > 0)],
      ...narrative.map((part): [string, boolean] => [`"${part.id}" within ${part.maxWords} words (${words(text(part.id))})`, words(text(part.id)) <= (part.maxWords ?? 200)]),
      ["parties written as stand-ins", all.includes("{{claimant}}") && all.includes("{{defendant}}")],
      ["no real name or address in the text", realDetails.every((name) => !all.includes(name))],
      ["the missing address left as its stand-in", all.includes("{{defendantAddress}}")],
      ["no case, statute, section, rule or order named", !AUTHORITY.test(all)],
      [`only the given sum (${sums.join(", ") || "none written"})`, sums.every((sum) => sum === "N2,350,000")],
      [`back within 30 seconds (${seconds.toFixed(1)} s)`, seconds <= 30],
    ];
    const lines = [
      `Drafting test: ${checks.filter(([, ok]) => ok).length}/${checks.length} checks passed`,
      `Model ${result.model}, ${result.usage.tokensIn} tokens in, ${result.usage.tokensOut} out, $${(result.costUsd ?? 0).toFixed(4)}`,
      ...checks.map(([what, ok]) => `${ok ? "PASS" : "FAIL"}: ${what}`),
    ];
    console.info(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.map((l) => `- ${l}`).join("\n") + "\n");
    expect(checks.filter(([, ok]) => !ok).map(([what]) => what)).toEqual([]);
  });
});
