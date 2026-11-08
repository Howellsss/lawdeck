import { describe, expect, it } from "vitest";
import { greetingName, isSmallTalk, quickReply, withoutName } from "@/lib/smallTalk";

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

describe("voice-mode instant replies with the student's name (founder, 2026-11-08)", () => {
  it("answers the founder's examples by name", () => {
    expect(quickReply("Hey Ryan", "Howells")).toBe("Hey Howells, what's up?");
    expect(quickReply("Hey Ryan, what's up?", "Howells")).toBe("I'm good, Howells, how about you?");
  });

  it("recognises every voice's name as a greeting", () => {
    for (const name of ["Sonia", "Ryan", "Ava", "Andrew", "Ezinne", "Abeo"]) {
      expect(isSmallTalk(`Hey ${name}`), name).toBe(true);
      expect(quickReply(`Hi ${name}`, "Ada"), name).toBe("Hey Ada, what's up?");
    }
  });

  it("matches the kind of small talk", () => {
    expect(quickReply("Thanks Ryan", "Ada")).toBe("Any time, Ada! What's next?");
    expect(quickReply("Okay bye", "Ada")).toBe("Bye Ada, talk soon!");
    expect(quickReply("I'm good", "Ada")).toBe("Glad to hear it, Ada. What are we studying today?");
    expect(quickReply("I'm fine, how about you?", "Ada")).toBe("I'm good too, thanks for asking, Ada. What are we studying today?");
    expect(quickReply("Good morning Ava", "Ada")).toBe("Hello Ada! How are you today?");
    expect(quickReply("How far?", "Ada")).toBe("I'm good, Ada, how about you?");
  });

  it("offers more than one wording", () => {
    expect(quickReply("Hey Ryan", "Ada", 1)).toBe("Hi Ada! What's on your mind?");
    expect(quickReply("Hey Ryan", "Ada", 2)).toBe("Hey Ada, what's up?");
  });

  it("still works without a name", () => {
    expect(quickReply("Hey Ryan", null)).toBe("Hey, what's up?");
    expect(quickReply("Hey Ryan, what's up?", null)).toBe("I'm good, how about you?");
  });

  it("leaves anything with a topic, and unclear small talk, to the model", () => {
    expect(quickReply("Hey Ryan, what is a writ of summons?", "Ada")).toBeNull();
    expect(quickReply("Yes, go on", "Ada")).toBeNull();
    expect(quickReply("Cool", "Ada")).toBeNull();
    expect(quickReply("", "Ada")).toBeNull();
  });
});

describe("the name a student is greeted by", () => {
  it("is the first word of their full name, tidied", () => {
    expect(greetingName("Howells Henry")).toBe("Howells");
    expect(greetingName("  chiamaka   obi ")).toBe("Chiamaka");
    expect(greetingName("Ọlá Adé")).toBe("Ọlá");
    expect(greetingName("O'Neil")).toBe("O'Neil");
  });

  it("is null when there is no usable name", () => {
    expect(greetingName(null)).toBeNull();
    expect(greetingName("")).toBeNull();
    expect(greetingName("   ")).toBeNull();
    expect(greetingName("123 456")).toBeNull();
  });
});

describe("keeping the name away from the AI", () => {
  it("takes the student's name out of earlier replies", () => {
    expect(withoutName("Hey Howells, what's up?", "Howells")).toBe("Hey, what's up?");
    expect(withoutName("I'm good, Howells, how about you?", "Howells")).toBe("I'm good, how about you?");
    expect(withoutName("Hello Howells! How are you today?", "Howells")).toBe("Hello! How are you today?");
    expect(withoutName("Any time, Ọlá! What's next?", "Ọlá")).toBe("Any time! What's next?");
  });

  it("leaves other words and texts alone", () => {
    expect(withoutName("Howellson v State is a case.", "Howells")).toBe("Howellson v State is a case.");
    expect(withoutName("Hey, what's up?", null)).toBe("Hey, what's up?");
  });
});
