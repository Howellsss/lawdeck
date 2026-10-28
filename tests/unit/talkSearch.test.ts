import { describe, expect, it } from "vitest";
import { talkSearchText } from "@/lib/talkSearch";

describe("voice-mode search text", () => {
  const history = [
    { role: "user" as const, text: "I'm confused about originating processes. Do you know about them?" },
    { role: "assistant" as const, text: "Yes, I can help [S2]. Shall I explain how they differ from pleadings?" },
  ];

  it("searches a short reply together with the recent conversation", () => {
    const text = talkSearchText("Yeah, please go on.", history);
    expect(text).toContain("originating processes");
    expect(text).toContain("differ from pleadings");
    expect(text.endsWith("Yeah, please go on.")).toBe(true);
    expect(text).not.toContain("[S2]");
  });

  it("searches a full question as it is, and a first message as it is", () => {
    const question = "What are the conditions for a confessional statement to be admissible in evidence?";
    expect(talkSearchText(question, history)).toBe(question);
    expect(talkSearchText("Hey, what's up?", [])).toBe("Hey, what's up?");
  });

  it("keeps the search text short", () => {
    const long = [{ role: "assistant" as const, text: "word ".repeat(1000) }];
    expect(talkSearchText("go on", long).length).toBeLessThanOrEqual(1200);
  });
});
