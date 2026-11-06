import { describe, expect, it } from "vitest";
import { applyFormat } from "@/components/chat/FormatBar";

describe("formatting bar", () => {
  it("wraps the selected words, or inserts a placeholder to type over", () => {
    expect(applyFormat("see Order 3", 4, 11, "bold")).toEqual({ text: "see **Order 3**", start: 6, end: 13 });
    expect(applyFormat("x", 1, 1, "italic").text).toBe("x_italic text_");
    expect(applyFormat("ab", 0, 2, "strike").text).toBe("~~ab~~");
    expect(applyFormat("r5", 0, 2, "code").text).toBe("`r5`");
  });

  it("makes a link with the address selected for typing", () => {
    const r = applyFormat("notes", 0, 5, "link");
    expect(r.text).toBe("[notes](https://)");
    expect(r.text.slice(r.start, r.end)).toBe("https://");
  });

  it("marks every selected line as a list or quote, replacing an old marker", () => {
    expect(applyFormat("a\nb", 0, 3, "ul").text).toBe("- a\n- b");
    expect(applyFormat("- a\n- b", 0, 7, "ol").text).toBe("1. a\n2. b");
    expect(applyFormat("a", 0, 1, "quote").text).toBe("> a");
  });
});
