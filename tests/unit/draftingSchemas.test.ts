import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  describeIssues,
  fieldTokens,
  forumFileSchema,
  templateFileSchema,
} from "@/schemas/drafting";
import { FORUM_FILES, TEMPLATE_FILES } from "@/templates";

// A made-up template for the tests only (no legal wording).
const template = () => ({
  slug: "wombat-notice",
  title: "Wombat notice",
  course: "civil-litigation",
  forums: ["quokka-court"],
  ruleSource: "Quokka Rules, Form 9",
  spec: {
    parts: [
      {
        id: "heading",
        kind: "fixed",
        text: "IN THE QUOKKA COURT\nBETWEEN {{claimant}} AND {{defendant}}",
        required: true,
        why: "Names the court and parties.",
      },
      {
        id: "facts",
        kind: "narrative",
        instruction: "State the facts from the intake.",
        maxWords: 300,
        required: true,
        why: "Sets out the claim.",
      },
      {
        id: "signature",
        kind: "signature",
        required: true,
        why: "Counsel signs.",
      },
    ],
    fields: [
      {
        id: "claimant",
        label: "Claimant",
        type: "party",
        required: true,
        question: "Who is suing?",
        placeholder: "CLAIMANT’S NAME",
      },
      {
        id: "defendant",
        label: "Defendant",
        type: "party",
        required: true,
        question: "Who is being sued?",
        placeholder: "DEFENDANT’S NAME",
        repeatable: true,
      },
    ],
    changeLog: [{ date: "2026-10-23", note: "First draft." }],
  },
});

describe("forum files", () => {
  it("accepts every forum file in src/templates", () => {
    for (const file of FORUM_FILES)
      expect(forumFileSchema.safeParse(file).success).toBe(true);
    expect(
      TEMPLATE_FILES.every(
        (file) => templateFileSchema.safeParse(file).success,
      ),
    ).toBe(true);
  });

  it("refuses a profile outside sensible limits or with unknown settings", () => {
    const base = {
      slug: "quokka-court",
      name: "Quokka Court",
      kind: "court",
      state: null,
      profile: DEFAULT_PROFILE,
    };
    expect(forumFileSchema.safeParse(base).success).toBe(true);
    expect(
      forumFileSchema.safeParse({
        ...base,
        profile: { ...DEFAULT_PROFILE, fontSizePt: 30 },
      }).success,
    ).toBe(false);
    expect(
      forumFileSchema.safeParse({
        ...base,
        profile: { ...DEFAULT_PROFILE, colour: "red" },
      }).success,
    ).toBe(false);
    expect(
      forumFileSchema.safeParse({ ...base, slug: "Quokka Court" }).success,
    ).toBe(false);
  });
});

describe("template files", () => {
  it("accepts a complete template and fills in defaults", () => {
    const parsed = templateFileSchema.parse(template());
    expect(parsed.spec.fields[0].repeatable).toBe(false);
    expect(parsed.spec.related).toEqual([]);
  });

  it("finds the intake fields used in fixed wording", () => {
    expect(
      fieldTokens("BETWEEN {{claimant}} AND {{ defendant }} {{}}"),
    ).toEqual(["claimant", "defendant"]);
  });

  it("refuses wording that uses a field that does not exist", () => {
    const file = template();
    file.spec.parts[0].text = "BETWEEN {{claimant}} AND {{respondent}}";
    const result = templateFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    expect(describeIssues(result.error!).join(" ")).toContain("{{respondent}}");
  });

  it("refuses fixed parts without wording and AI parts without an instruction and limit", () => {
    const file = template();
    delete (file.spec.parts[0] as { text?: string }).text;
    delete (file.spec.parts[1] as { maxWords?: number }).maxWords;
    const messages = describeIssues(
      templateFileSchema.safeParse(file).error!,
    ).join(" ");
    expect(messages).toContain("needs its fixed wording");
    expect(messages).toContain("instruction and a word limit");
  });

  it("refuses duplicate names, parts for courts the template is not for, and a missing change log", () => {
    const file = template();
    file.spec.parts.push({ ...file.spec.parts[2] });
    (file.spec.parts[1] as { forums?: string[] }).forums = ["another-court"];
    file.spec.changeLog = [];
    const messages = describeIssues(
      templateFileSchema.safeParse(file).error!,
    ).join(" ");
    expect(messages).toContain('Two parts are called "signature"');
    expect(messages).toContain("changeLog");
  });

  it("refuses a part limited to a court the template is not for", () => {
    const file = template();
    (file.spec.parts[1] as { forums?: string[] }).forums = ["another-court"];
    expect(
      describeIssues(templateFileSchema.safeParse(file).error!).join(" "),
    ).toContain('names "another-court"');
  });

  it("refuses placeholders that are not in capitals", () => {
    const file = template();
    file.spec.fields[0].placeholder = "claimant name";
    expect(templateFileSchema.safeParse(file).success).toBe(false);
  });
});
