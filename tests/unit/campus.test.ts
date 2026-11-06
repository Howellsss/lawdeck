import { describe, expect, it } from "vitest";
import { campusSchema } from "@/schemas/profile";

describe("campus choice", () => {
  it("accepts a campus key or nothing (to clear it)", () => {
    expect(campusSchema.safeParse({ campus: "port-harcourt" }).success).toBe(true);
    expect(campusSchema.safeParse({ campus: "aspirant" }).success).toBe(true);
    expect(campusSchema.safeParse({ campus: "" }).success).toBe(true);
  });

  it("refuses anything that is not a key", () => {
    for (const bad of ["Lagos", "lagos campus", "../x", "a", "lagos; drop"]) expect(campusSchema.safeParse({ campus: bad }).success).toBe(false);
  });
});
