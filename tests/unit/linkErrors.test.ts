import { describe, expect, it } from "vitest";
import { linkErrorMessage } from "@/lib/linkErrors";

describe("email link error messages", () => {
  it("explains an expired link", () => {
    expect(linkErrorMessage("link")).toMatch(/expired or was already used/);
  });

  it("explains a link opened in another browser", () => {
    expect(linkErrorMessage("browser")).toMatch(/same browser/);
  });

  it("explains an unfinished Google sign-in", () => {
    expect(linkErrorMessage("google")).toMatch(/Google sign-in didn’t finish/);
  });

  it("shows nothing for missing or unknown codes", () => {
    expect(linkErrorMessage(null)).toBeUndefined();
    expect(linkErrorMessage("anything")).toBeUndefined();
  });
});
