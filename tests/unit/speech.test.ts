import { describe, expect, it } from "vitest";
import { PRONUNCIATIONS } from "@/lib/pronunciations";
import { answerScope, speakableText, speechParts, speechSsml } from "@/lib/speech";
import { pronunciationFileSchema, speechRequestSchema } from "@/schemas/voice";

// Made-up answers; real case names only as examples of how names are read.
const ANSWER = [
  "## Short answer",
  "A civil action needs at least two **legal persons** [S1].",
  "",
  "## The rule",
  "- In Agbonmagbe Bank Ltd v. General Manager, G.B. Ollivant Ltd & Anor (1961) the company was not sued [S2].",
  "- State v. Okafor: see s. 36(6) CFRN and O. 13 r. 4.",
].join("\n");

describe("what to read", () => {
  it("reads only the short answer, or what follows it", () => {
    expect(answerScope(ANSWER, "short")).toBe("A civil action needs at least two **legal persons** [S1].");
    expect(answerScope(ANSWER, "rest")).toMatch(/^## The rule/);
    expect(answerScope(ANSWER, "full")).toBe(ANSWER);
  });

  it("uses the first paragraph when there is no Short answer heading", () => {
    const plain = "First paragraph here.\nStill first.\n\nSecond paragraph.";
    expect(answerScope(plain, "short")).toBe("First paragraph here.\nStill first.");
    expect(answerScope(plain, "rest")).toBe("Second paragraph.");
    expect(answerScope("One line only.", "rest")).toBe("");
  });
});

describe("reading like a lawyer", () => {
  const spoken = speakableText(ANSWER);

  it("drops headings marks, bold and citation markers", () => {
    expect(spoken).not.toMatch(/##|\*\*|\[S\d\]/);
    expect(spoken).toMatch(/^Short answer\. A civil action/);
  });

  it("reads 'v.' as 'and' in civil cases and 'against' in criminal ones", () => {
    expect(spoken).toContain("Agbonmagbe Bank Limited and General Manager");
    expect(spoken).toContain("State against Okafor");
    expect(spoken).toContain("Limited and another");
  });

  it("reads sections, orders, rules and law reports aloud", () => {
    expect(spoken).toContain("section 36(6) C.F.R.N.");
    expect(spoken).toContain("Order 13 rule 4");
    expect(speakableText("(2001) 7 NWLR (Pt. 712) 1")).toBe("(2001) 7 N.W.L.R. part 712 1.");
    expect(speakableText("e.g. a company, i.e. a legal person")).toBe("for example a company, that is a legal person.");
  });
});

describe("splitting into parts", () => {
  it("keeps parts under the limit and ends them at sentences", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const parts = speechParts(text, 200);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= 200 && part.endsWith("."))).toBe(true);
    expect(parts.join(" ")).toBe(text);
  });

  it("cuts a very long sentence rather than sending it whole", () => {
    expect(speechParts("word ".repeat(400).trim(), 300).every((part) => part.length <= 300)).toBe(true);
  });
});

describe("the voice service request", () => {
  it("says listed names their way and keeps everything else as plain text", () => {
    const ssml = speechSsml("Shitta-Bey & Njemanze <b>", "en-NG-EzinneNeural", [
      { name: "Shitta", say: "Sheetah" },
      { name: "Shitta-Bey", say: "Sheetah Bay" },
      { name: "Njemanze", say: "Njeh manzeh" },
    ]);
    expect(ssml).toContain('<voice name="en-NG-EzinneNeural">');
    expect(ssml).toContain('<sub alias="Sheetah Bay">Shitta-Bey</sub>');
    expect(ssml).toContain('<sub alias="Njeh manzeh">Njemanze</sub>');
    expect(ssml).toContain("&amp; ");
    expect(ssml).toContain("&lt;b&gt;");
    expect(ssml).not.toContain("<b>");
  });

  it("matches whole names only, ignoring capitals", () => {
    const ssml = speechSsml("ONITSHA and Onitshas", "v", [{ name: "Onitsha", say: "Onicha" }]);
    expect(ssml).toContain('<sub alias="Onicha">ONITSHA</sub>');
    expect(ssml).toContain(" Onitshas");
  });
});

describe("checks", () => {
  it("the pronunciation list passes its schema", () => {
    expect(PRONUNCIATIONS.length).toBeGreaterThan(0);
    expect(() => pronunciationFileSchema.parse({ note: "", names: [{ name: "<x>", say: "y" }] })).toThrow();
  });

  it("speech requests need a real answer id and a known voice", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(speechRequestSchema.parse({ messageId: id, part: 0 })).toMatchObject({ scope: "full", voice: "uk-female" });
    expect(speechRequestSchema.safeParse({ messageId: "x", part: 0 }).success).toBe(false);
    expect(speechRequestSchema.safeParse({ messageId: id, part: 0, voice: "robot" }).success).toBe(false);
    // The old two-voice choice is no longer accepted; browsers holding it fall back to the default.
    expect(speechRequestSchema.safeParse({ messageId: id, part: 0, voice: "female" }).success).toBe(false);
    for (const voice of ["uk-male", "us-female", "us-male", "ng-female", "ng-male"])
      expect(speechRequestSchema.safeParse({ messageId: id, part: 0, voice }).success).toBe(true);
  });
});
