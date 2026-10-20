import { describe, expect, it } from "vitest";
import { greetingFor } from "@/lib/greeting";
import { DEFAULT_THEME, nextTheme } from "@/lib/theme";

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greetingFor(8)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good evening");
  });
});

describe("theme", () => {
  it("starts dark and switches both ways", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme(undefined)).toBe("light");
  });
});
