import { describe, expect, it } from "vitest";
import { isSmallTalk } from "@/lib/smallTalk";

describe("voice-mode small talk", () => {
  it("recognises greetings, thanks and goodbyes, however they are said", () => {
    for (const text of [
      "Hey, what's up?",
      "Hey Lord, what's up?",
      "Hi Lawdeck",
      "All good, all good, all good.",
      "I'm fine, thanks. How are you?",
      "Good morning!",
      "How far?",
      "Thank you so much",
      "Okay bye",
    ])
      expect(isSmallTalk(text), text).toBe(true);
  });

  it("sends anything with a topic, and follow-ups, to the library", () => {
    for (const text of [
      "I'm having complications understanding confessional statements. Do you know about it?",
      "Yeah, please go on and tell me about confessional statements",
      "Yes, go on",
      "What is a writ of summons?",
      "Hi, what is a pleading?",
      "Thanks, and what about the exceptions?",
      "",
    ])
      expect(isSmallTalk(text), text).toBe(false);
  });
});
