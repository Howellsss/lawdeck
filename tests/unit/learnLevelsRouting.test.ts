import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLAIN_SYSTEM, isScenario, LEVEL_INSTRUCTIONS, questionMessage } from "@/prompts/explain";
import { isTopicOnly, parseRoute } from "@/prompts/route";
import { startChatSchema, topicNameSchema, topicSlug } from "@/schemas/learn";
import { routeRequest } from "@/server/ai/route";

describe("answer levels", () => {
  it("adds the chosen level to the question, leaving the cached instructions unchanged", () => {
    expect(questionMessage([], "Why?", "simple")).toContain(LEVEL_INSTRUCTIONS.simple);
    expect(questionMessage([], "Why?", "exam")).toContain(LEVEL_INSTRUCTIONS.exam);
    expect(questionMessage([], "Why?")).toContain(LEVEL_INSTRUCTIONS.exam);
    expect(EXPLAIN_SYSTEM).not.toContain("Answer level");
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
  it("takes a full exam problem question of about 1,200 words, and no more than 8,000 characters", async () => {
    const { askSchema } = await import("@/schemas/learn");
    expect(askSchema.safeParse({ question: "facts ".repeat(1300).slice(0, 7990), level: "exam" }).success).toBe(true);
    expect(askSchema.safeParse({ question: "x".repeat(8001), level: "exam" }).success).toBe(false);
  });
});
