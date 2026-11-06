import { describe, expect, it } from "vitest";
import { applyFormat } from "@/components/chat/FormatBar";
import { cleanLink } from "@/components/chat/LinkDialog";
import { linkLabels } from "@/lib/chatFormat";

describe("formatting bar", () => {
  it("wraps the selected words, or inserts a placeholder to type over", () => {
    expect(applyFormat("see Order 3", 4, 11, "bold")).toEqual({ text: "see **Order 3**", start: 6, end: 13 });
    expect(applyFormat("x", 1, 1, "italic").text).toBe("x_italic text_");
    expect(applyFormat("ab", 0, 2, "strike").text).toBe("~~ab~~");
    expect(applyFormat("r5", 0, 2, "code").text).toBe("`r5`");
    expect(applyFormat("see", 0, 3, "underline").text).toBe("++see++");
  });

  it("leaves links to the Add link box: the text keeps only the words until sent", () => {
    expect(applyFormat("notes", 0, 5, "link")).toEqual({ text: "notes", start: 0, end: 5 });
    expect(linkLabels("See Test today", [{ label: "Test", href: "https://mylawdeck.com" }])).toBe("See [Test](https://mylawdeck.com) today");
    expect(linkLabels("Order 3 and Order 3 rule 5", [
      { label: "Order 3", href: "https://a.ng" },
      { label: "Order 3 rule 5", href: "https://b.ng" },
    ])).toBe("[Order 3](https://a.ng) and [Order 3 rule 5](https://b.ng)");
    expect(linkLabels("words gone", [{ label: "Test", href: "https://x.ng" }])).toBe("words gone");
  });

  it("accepts web addresses only, adding https:// when left out", () => {
    expect(cleanLink("mylawdeck.com/diary")).toBe("https://mylawdeck.com/diary");
    expect(cleanLink(" http://nls.edu.ng ")).toBe("http://nls.edu.ng");
    expect(cleanLink("javascript:alert(1)")).toBeNull();
    expect(cleanLink("https://")).toBeNull();
    expect(cleanLink("not a link")).toBeNull();
    expect(cleanLink("localhost")).toBeNull();
  });

  it("marks every selected line as a list or quote, replacing an old marker", () => {
    expect(applyFormat("a\nb", 0, 3, "ul").text).toBe("- a\n- b");
    expect(applyFormat("- a\n- b", 0, 7, "ol").text).toBe("1. a\n2. b");
    expect(applyFormat("a", 0, 1, "quote").text).toBe("> a");
  });
});
