import { describe, expect, it } from "vitest";
import { EMOJI_GROUPS } from "@/lib/emojiData";

describe("emoji pack", () => {
  const all = EMOJI_GROUPS.flatMap((g) => g.emojis);
  it("has every standard emoji up to Emoji 15.1, in nine groups", () => {
    expect(EMOJI_GROUPS.map((g) => g.name)).toEqual(["Smileys", "People", "Nature", "Food", "Travel", "Activities", "Objects", "Symbols", "Flags"]);
    expect(all.length).toBe(1898);
    expect(new Set(all.map(([e]) => e)).size).toBe(all.length);
  });
  it("names each emoji so it can be searched and read aloud", () => {
    expect(all.every(([e, name]) => e.length > 0 && name.length > 0)).toBe(true);
    expect(all.find(([, name]) => name === "flag Nigeria")?.[0]).toBe("🇳🇬");
    expect(all.find(([, name]) => name === "balance scale")?.[0]).toBe("⚖️");
  });
});
