import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLAIN_SYSTEM, isScenario, LEVEL_INSTRUCTIONS, PICKABLE_LEVELS, questionMessage } from "@/prompts/explain";
import { isTopicOnly, parseRoute } from "@/prompts/route";
import { askSchema, startChatSchema, topicNameSchema, topicSlug } from "@/schemas/learn";
import { EXPLAIN_LONG_MAX_TOKENS, EXPLAIN_MAX_TOKENS, EXPLAIN_TALK_MAX_TOKENS } from "@/server/ai/explain";
import { routeRequest } from "@/server/ai/route";

describe("answer levels", () => {
  it("adds the chosen level to the question, leaving the cached instructions unchanged", () => {
    expect(questionMessage([], "Why?", "simple")).toContain(LEVEL_INSTRUCTIONS.simple);
    expect(questionMessage([], "Why?", "exam")).toContain(LEVEL_INSTRUCTIONS.exam);
    expect(questionMessage([], "Why?")).toContain(LEVEL_INSTRUCTIONS.exam);
    expect(EXPLAIN_SYSTEM).not.toContain("Answer level");
  });
});

describe("voice-mode conversation (founder, 2026-10-28)", () => {
  it("replies in a few spoken sentences that end with a question back to the student", () => {
    const talk = LEVEL_INSTRUCTIONS.talk;
    expect(questionMessage([], "Why?", "talk")).toContain(talk);
    expect(talk).toContain("two to five short");
    expect(talk).toContain("If the student greets you");
    expect(talk).toContain("check what they want before explaining at length");
    expect(talk).toContain("end with one short question or offer");
    expect(talk).toContain("Never use the section headings");
  });

  it("keeps every safety rule: passages only, ids for the citation check, corrections", () => {
    const talk = LEVEL_INSTRUCTIONS.talk;
    expect(talk).toContain("Legal points come only from the passages; never from memory");
    expect(talk).toContain("passage id after the point");
    expect(talk).toContain("Correct anything wrong the student says");
  });

  it("is short, used by voice mode only, and never offered in the level picker", () => {
    expect(EXPLAIN_TALK_MAX_TOKENS).toBeLessThan(EXPLAIN_MAX_TOKENS);
    expect(PICKABLE_LEVELS).not.toContain("talk");
    expect(askSchema.parse({ question: "Why?", level: "talk" }).level).toBe("talk");
    expect(askSchema.safeParse({ question: "Why?", level: "chatty" }).success).toBe(false);
  });
});

describe("problem questions", () => {
  it("are recognised by their length, so they get more passages", () => {
    expect(isScenario("What is a pre-action notice?")).toBe(false);
    expect(isScenario(Array.from({ length: 45 }, (_, i) => `word${i}`).join(" "))).toBe(true);
  });

  it("are answered issue by issue, ending with advice, from the passages only", () => {
    for (const heading of ["## The facts in brief", "## Issues", "## Issue 1:", "## Advice"]) expect(EXPLAIN_SYSTEM).toContain(heading);
    expect(EXPLAIN_SYSTEM).toContain("does not cover it yet");
    expect(EXPLAIN_SYSTEM).toContain("Never fill a gap with outside knowledge");
  });

  it("go into every issue in depth, at Law School exam standard", () => {
    expect(EXPLAIN_SYSTEM).toContain("at the standard of a Nigerian Law School exam answer");
    expect(EXPLAIN_SYSTEM).toContain("apply it to the specific facts");
  });
});

describe("citations (founder, 2026-10-25)", () => {
  it("name authorities in full, as in an exam script, and list them last", () => {
    expect(EXPLAIN_SYSTEM).toContain("name every authority in full, never by its id alone");
    expect(EXPLAIN_SYSTEM).toContain("(as amended)");
    expect(EXPLAIN_SYSTEM).toContain("NWLR");
    expect(EXPLAIN_SYSTEM.trimEnd().indexOf("## Authorities")).toBeGreaterThan(EXPLAIN_SYSTEM.indexOf("## Exam tip"));
  });

  it("never complete a citation from memory, and keep the passage ids for the citation check", () => {
    expect(EXPLAIN_SYSTEM).toContain("Never complete or correct a citation from memory");
    expect(EXPLAIN_SYSTEM).toContain("write the case name only");
    expect(EXPLAIN_SYSTEM).toContain("put its id in square brackets");
  });

  it("give problem questions more room than ordinary answers", () => {
    expect(EXPLAIN_LONG_MAX_TOKENS).toBeGreaterThan(EXPLAIN_MAX_TOKENS);
  });
});

describe("Auto mode routing", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads Claude's one-word reply", () => {
    expect(parseRoute("learn")).toBe("learn");
    expect(parseRoute(" Draft.\n")).toBe("draft");
    expect(parseRoute("I think learn")).toBeNull();
    expect(parseRoute("")).toBeNull();
  });

  it("treats a topic on its own as a question, without asking Claude", async () => {
    for (const topic of ["charges", "Charges", "bail pending trial", "writ of summons", "  affidavit "]) {
      expect(isTopicOnly(topic)).toBe(true);
    }
    for (const request of ["Draft a charge", "prepare a writ", "Write my affidavit", "Explain the rules on joinder of parties"]) {
      expect(isTopicOnly(request)).toBe(false);
    }
    expect(isTopicOnly("   ")).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await routeRequest("charges", "test")).toBe("learn");
  });

  it("gives no answer (so Learn is used) when Claude is not set up", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await routeRequest("Draft a writ", "test")).toBeNull();
  });

  it("starts chats as Learn unless Auto is asked for", () => {
    expect(startChatSchema.parse({ question: "Why?", course: "all" }).mode).toBe("learn");
    expect(startChatSchema.parse({ question: "Why?", course: "civil-litigation", mode: "auto" }).mode).toBe("auto");
    expect(startChatSchema.safeParse({ question: "Why?", course: "all", mode: "draft" }).success).toBe(false);
  });
});

describe("course topics", () => {
  it("make tidy web addresses from their names", () => {
    expect(topicSlug("Service of Process")).toBe("service-of-process");
    expect(topicSlug("  Pre-action Protocol (Lagos) ")).toBe("pre-action-protocol-lagos");
    expect(topicSlug("***")).toBe("topic");
    expect(topicSlug("x".repeat(100)).length).toBeLessThanOrEqual(80);
  });

  it("need a sensible name", () => {
    expect(topicNameSchema.parse("  Service   of process ")).toBe("Service of process");
    expect(topicNameSchema.safeParse(" ").success).toBe(false);
    expect(topicNameSchema.safeParse("x".repeat(161)).success).toBe(false);
  });
});

describe("question length", () => {
  it("takes a long exam problem question, up to 20,000 characters", async () => {
    const { askSchema } = await import("@/schemas/learn");
    expect(askSchema.safeParse({ question: "facts ".repeat(3400).slice(0, 19990), level: "exam" }).success).toBe(true);
    expect(askSchema.safeParse({ question: "x".repeat(20001), level: "exam" }).success).toBe(false);
    const { draftRequestSchema } = await import("@/schemas/drafting");
    expect(draftRequestSchema.safeParse({ request: "facts ".repeat(1000), course: "all" }).success).toBe(true);
  });

  it("sends a long problem question to Learn without asking Claude, even if it mentions drafting", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const scenario = `Ade instructs you to draft a writ. ${"The facts are long and detailed. ".repeat(10)}Advise Ade.`;
    expect(await routeRequest(scenario, "test")).toBe("learn");
    vi.unstubAllEnvs();
  });
});
