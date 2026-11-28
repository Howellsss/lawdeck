import { describe, expect, it } from "vitest";
import { revealSchema } from "@/schemas/study";

// Recall questions in Study need no typing (founder, 2026-11-28): the student answers in their
// head and taps "Show answer", which is sent as `recalled`.
describe("showing a recall answer without typing", () => {
  const id = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";

  it("accepts a student who answered in their head", () => {
    expect(revealSchema.parse({ checkpointId: id, recalled: true })).toMatchObject({ recalled: true, answer: "", skipped: false });
  });

  it("still knows when nothing was tried", () => {
    expect(revealSchema.parse({ checkpointId: id })).toMatchObject({ recalled: false, answer: "", skipped: false });
    expect(revealSchema.safeParse({ checkpointId: "not-an-id", recalled: true }).success).toBe(false);
  });
});
