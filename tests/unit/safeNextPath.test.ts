import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safeNextPath";

describe("safeNextPath", () => {
  it("keeps Lawdeck paths", () => {
    expect(safeNextPath("/courses")).toBe("/courses");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/projects?tab=recent#top")).toBe("/projects?tab=recent#top");
  });

  it.each([
    ["another site", "https://evil.example/steal"],
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["embedded backslash", "/courses\\..\\//evil.example"],
    ["javascript url", "javascript:alert(1)"],
    ["relative path", "courses"],
    ["control character", "/\tevil"],
    ["empty", ""],
  ])("rejects %s", (_name, value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("rejects non-strings and very long values", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(42)).toBe("/");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.example", "/sign-in")).toBe("/sign-in");
  });
});
