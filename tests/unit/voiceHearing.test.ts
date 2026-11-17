import { describe, expect, it } from "vitest";
import { bestHeard, buildVocabulary, correctHeard, namesLibraryTopic } from "@/lib/legalWords";
import { otherGuesses } from "@/components/learn/recognition";
import { combineTalkHits } from "@/server/learn/ask";
import { askSchema } from "@/schemas/learn";
import type { SearchHit } from "@/server/retrieval/search";

// Voice mode (founder, 2026-11-17): misheard law words are corrected against the library's own
// names. These names stand in for courses, topics and book titles read from the database.
const vocabulary = buildVocabulary([
  "Property Law Practice",
  "Mortgages",
  "Wills and Codicils",
  "Probate Practice",
  "Civil Litigation",
  "Criminal Litigation",
  "Land Use Act",
  "Leases",
]);

describe("correcting misheard law words", () => {
  it("fixes the founder's examples", () => {
    expect(correctHeard("teach me mod gauge", vocabulary)).toBe("teach me mortgage");
    expect(correctHeard("teach me mod gauges", vocabulary)).toBe("teach me mortgages");
    expect(correctHeard("explain private practice to me", vocabulary)).toBe("explain probate practice to me");
    expect(correctHeard("tell me about wheels and codesels?", vocabulary)).toBe("tell me about wills and codicils?");
  });

  it("leaves what was heard right, and everyday words, alone", () => {
    for (const said of [
      "Wills and codicils please",
      "I want to study probate practice",
      "Well, let's go",
      "yes go on",
      "what about the lent",
      "explain the land use act",
      "Hey Ryan, what's up?",
    ])
      expect(correctHeard(said, vocabulary)).toBe(said);
  });

  it("never changes words the library itself uses", () => {
    const withPrivate = buildVocabulary(["Probate Practice", "Lawyers in private practice"]);
    expect(correctHeard("explain private practice", withPrivate)).toBe("explain private practice");
  });

  it("changes nothing when the library's names could not be read", () => {
    expect(correctHeard("teach me mod gauge", buildVocabulary([]))).toBe("teach me mod gauge");
  });

  it("picks the browser's guess that names a law topic", () => {
    expect(bestHeard("teach me mod gauge", ["teach me mortgage"], vocabulary)).toBe("teach me mortgage");
    expect(bestHeard("yes go on", ["yes go one"], vocabulary)).toBe("yes go on");
  });

  it("tells a new topic from a follow-up", () => {
    expect(namesLibraryTopic("explain probate practice", vocabulary)).toBe(true);
    expect(namesLibraryTopic("yes, please go on", vocabulary)).toBe(false);
  });
});

describe("the browser's other guesses", () => {
  const phrase = (...guesses: string[]) => Object.assign(guesses.map((transcript) => ({ transcript })), { isFinal: true });

  it("builds each whole-turn guess, without repeating the best one", () => {
    const results = [phrase("teach me ", "teach me "), phrase("mod gauge", "mortgage", "mod gage")];
    expect(otherGuesses(results, "teach me mod gauge")).toEqual(["teach me mortgage", "teach me mod gage"]);
  });

  it("gives none when the browser offers only one guess", () => {
    expect(otherGuesses([phrase("teach me mortgage")], "teach me mortgage")).toEqual([]);
  });
});

describe("voice-mode search of a short turn", () => {
  const hit = (id: string): SearchHit => ({
    passageId: id,
    itemId: "item",
    itemTitle: "Book",
    heading: null,
    text: id,
    pageFrom: null,
    pageTo: null,
    score: 1,
    meaningRank: 1,
    wordsRank: 1,
  });
  const result = (ids: string[]) => ({ ok: true as const, meaningUsed: true, reranked: true, hits: ids.map(hit) });
  const ids = (found: ReturnType<typeof combineTalkHits>) => (found.ok ? found.hits.map((h) => h.passageId) : []);
  const alone = result(["new1", "new2", "new3", "new4", "new5", "new6"]);
  const together = result(["old1", "old2", "old3", "new1"]);

  it("lets a new topic's own passages lead", () => {
    expect(ids(combineTalkHits(alone, together, true, 8))).toEqual(["new1", "new2", "new3", "new4", "new5", "old1", "new6", "old2"]);
  });

  it("lets the conversation lead for a follow-up such as 'yes, go on'", () => {
    expect(ids(combineTalkHits(alone, together, false, 8)).slice(0, 4)).toEqual(["old1", "old2", "old3", "new1"]);
  });
});

describe("what voice mode sends", () => {
  it("accepts up to five guesses and no more", () => {
    expect(askSchema.safeParse({ question: "mod gauge", level: "talk", alternatives: ["mortgage"] }).success).toBe(true);
    expect(askSchema.safeParse({ question: "mod gauge", level: "talk", alternatives: Array(6).fill("x") }).success).toBe(false);
    expect(askSchema.safeParse({ question: "Why?", level: "exam" }).success).toBe(true);
  });
});
