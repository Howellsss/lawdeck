import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evalCasesSchema } from "@/schemas/evalCases";

describe("the answer test set (step 3e)", () => {
  const file = evalCasesSchema.parse(JSON.parse(readFileSync("tests/eval/explain/civil-litigation.json", "utf8")));

  it("has at least 40 questions and 12 pushback cases, 3 of each kind", () => {
    expect(file.questions.length).toBeGreaterThanOrEqual(40);
    for (const type of ["wrong_statement", "holds_position", "fake_authority", "valid_correction"]) {
      expect(file.pushback.filter((p) => p.type === type).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses each case id once", () => {
    const ids = [...file.questions.map((q) => q.id), ...file.pushback.map((p) => p.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps copied wording short (the repository is public)", () => {
    for (const q of file.questions) expect(q.sourcePhrase.split(/\s+/).length).toBeLessThanOrEqual(15);
    for (const p of file.pushback) expect(p.sourcePhrase.split(/\s+/).length).toBeLessThanOrEqual(15);
  });
});
