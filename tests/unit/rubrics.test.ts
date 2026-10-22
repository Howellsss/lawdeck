import { describe, expect, it } from "vitest";
import { parseCriteria, rubricSchema, totalMarks } from "@/schemas/rubrics";

// Made-up content, for the tests only.
const base = {
  courseId: "11111111-1111-4111-8111-111111111111",
  topicId: "",
  title: "Quokka renewal",
  question: "Your client's quokka writ has expired. Advise.",
  criteria: [{ point: "Writ has expired", marks: 2 }],
};

describe("marking guides", () => {
  it("accepts a complete guide and tidies it", () => {
    const parsed = rubricSchema.parse({ ...base, title: "  Quokka renewal  ", criteria: [{ point: " Writ has expired ", marks: "2" }] });
    expect(parsed).toMatchObject({ title: "Quokka renewal", topicId: null, criteria: [{ point: "Writ has expired", marks: 2 }] });
  });

  it("needs the question and at least one marking point", () => {
    expect(rubricSchema.safeParse({ ...base, question: "Advise." }).success).toBe(false);
    expect(rubricSchema.safeParse({ ...base, criteria: [] }).success).toBe(false);
    expect(rubricSchema.safeParse({ ...base, criteria: [{ point: "", marks: 2 }] }).success).toBe(false);
  });

  it("keeps marks whole numbers from 1 to 20, and at most 30 points", () => {
    for (const marks of [0, 21, 1.5]) expect(rubricSchema.safeParse({ ...base, criteria: [{ point: "A point", marks }] }).success).toBe(false);
    const many = Array.from({ length: 31 }, () => ({ point: "A point", marks: 1 }));
    expect(rubricSchema.safeParse({ ...base, criteria: many }).success).toBe(false);
  });

  it("adds up the marks and reads saved points safely", () => {
    expect(totalMarks([{ marks: 2 }, { marks: 3 }, { marks: Number.NaN }])).toBe(5);
    expect(parseCriteria([{ point: "A", marks: 2 }, { point: 3 }, "x"])).toEqual([{ point: "A", marks: 2 }]);
  });
});
