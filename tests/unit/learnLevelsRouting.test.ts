import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLAIN_SYSTEM, LEVEL_INSTRUCTIONS, questionMessage } from "@/prompts/explain";
import { parseRoute } from "@/prompts/route";
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

describe("Auto mode routing", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads Claude's one-word reply", () => {
    expect(parseRoute("learn")).toBe("learn");
    expect(parseRoute(" Draft.\n")).toBe("draft");
    expect(parseRoute("I think learn")).toBeNull();
    expect(parseRoute("")).toBeNull();
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
