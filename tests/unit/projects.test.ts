import { describe, expect, it } from "vitest";
import { formatWat } from "@/lib/dates";
import { createProjectSchema, deleteProjectSchema, renameProjectSchema } from "@/schemas/projects";

describe("project names", () => {
  it("tidies spaces", () => {
    expect(createProjectSchema.parse({ name: "  Civil   Litigation  revision " }).name).toBe(
      "Civil Litigation revision",
    );
  });

  it("rejects empty or blank names", () => {
    expect(createProjectSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });

  it("allows 120 characters and rejects more", () => {
    expect(createProjectSchema.safeParse({ name: "a".repeat(120) }).success).toBe(true);
    expect(createProjectSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
  });
});

describe("project ids", () => {
  it("must be real ids, so odd addresses never reach the database", () => {
    const id = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";
    expect(renameProjectSchema.safeParse({ id, name: "x" }).success).toBe(true);
    expect(deleteProjectSchema.safeParse({ id: "1 or 1=1" }).success).toBe(false);
    expect(deleteProjectSchema.safeParse({ id: "" }).success).toBe(false);
  });
});

describe("dates in West Africa Time", () => {
  it("shows UTC times one hour ahead, in Lagos time", () => {
    expect(formatWat("2026-10-21T23:30:00Z")).toMatch(/22 Oct 2026/);
    expect(formatWat("2026-10-21T08:05:00Z")).toMatch(/9:05/);
  });

  it("shows nothing for a broken date", () => {
    expect(formatWat("not a date")).toBe("");
  });
});
