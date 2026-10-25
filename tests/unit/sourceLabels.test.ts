import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { studentSourceText } from "@/lib/sourceLabels";
import { EXPLAIN_SYSTEM, passagesBlock } from "@/prompts/explain";

const templatesDir = join(process.cwd(), "src/templates/documents");

describe("template notes students see (founder, 2026-10-25)", () => {
  it("name the private drafting materials by course, never by person", () => {
    expect(studentSourceText("Source: S.A Badmus' Civil Litigation drafts (Lawdeck knowledge base) (Form 1).")).toBe(
      "Source: Civil Litigation drafting materials (Form 1).",
    );
    expect(studentSourceText("S.A Badmus' Property Law drafts (Lawdeck knowledge base); Property Law Practice Handbook 2025.")).toBe(
      "Property Law Practice drafting materials; Property Law Practice Handbook 2025.",
    );
  });

  it("keep named handbooks and every other word as they are", () => {
    expect(studentSourceText("Civil Litigation Handbook 2025 (accrual of action)")).toBe("Civil Litigation Handbook 2025 (accrual of action)");
  });

  it("leave no personal attribution in any template note", () => {
    for (const file of readdirSync(templatesDir).filter((name) => name.endsWith(".json"))) {
      const template = JSON.parse(readFileSync(join(templatesDir, file), "utf8")) as { spec: { parts: { why: string }[] } };
      for (const part of template.spec.parts) expect(studentSourceText(part.why), `${file}`).not.toMatch(/Badmus/);
    }
  });
});

describe("what the model is told about each passage (migration 37)", () => {
  const base = { label: 1, itemTitle: "Civil Litigation — Accrual of Action", heading: null, pages: null, text: "Text." };

  it("marks official text, publications and study notes", () => {
    expect(passagesBlock([{ ...base, sourceKind: "official" }])).toContain('material="official document"');
    expect(passagesBlock([{ ...base, sourceKind: "publication" }])).toContain('material="publication"');
    expect(passagesBlock([{ ...base, sourceKind: "lecturer_note" }])).toContain('material="study notes"');
    expect(passagesBlock([{ ...base, sourceKind: "pending" }])).toContain('material="study notes"');
  });

  it("says nothing about material for a student's own upload, or when it is unknown", () => {
    expect(passagesBlock([{ ...base, origin: "upload", sourceKind: "official" }])).not.toContain("material=");
    expect(passagesBlock([base])).not.toContain("material=");
  });

  it("gives the label as the source, never a file name", () => {
    expect(passagesBlock([base])).toContain('source="Civil Litigation — Accrual of Action"');
  });
});

describe("answer instructions (founder, 2026-10-25)", () => {
  it("ask for original explanation, never copying or cosmetic paraphrase", () => {
    expect(EXPLAIN_SYSTEM).toContain("never disguise copying by swapping synonyms or reordering sentences");
    expect(EXPLAIN_SYSTEM).toContain("in your own structure and words");
  });

  it("never name the author of study notes, and keep labels apart from legal authority", () => {
    expect(EXPLAIN_SYSTEM).toContain("Never name the lecturer or author of study notes, or any file name");
    expect(EXPLAIN_SYSTEM).toContain("they are not legal authorities");
  });

  it("put legal accuracy first, prefer binding text in a conflict, and flag what cannot be confirmed", () => {
    expect(EXPLAIN_SYSTEM).toContain("Legal accuracy comes first");
    expect(EXPLAIN_SYSTEM).toContain("prefer the official document over publications and study notes");
    expect(EXPLAIN_SYSTEM).toContain("cannot be confirmed");
  });
});
