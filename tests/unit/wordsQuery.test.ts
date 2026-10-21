import { describe, expect, it } from "vitest";
import { anyWordsQuery } from "@/lib/wordsQuery";

describe("exact-words query that matches most words", () => {
  it("joins the words with or and drops punctuation", () => {
    expect(anyWordsQuery("Does S. 308 immunity cover a governor?")).toBe("Does or S or 308 or immunity or cover or a or governor");
  });

  it("drops words the search treats as commands, and minus signs", () => {
    expect(anyWordsQuery("trial and -appeal or not")).toBe("trial or appeal");
  });

  it("keeps rule and form numbers like 4A", () => {
    expect(anyWordsQuery("What is Form 4A?")).toBe("What or is or Form or 4A");
  });

  it("returns an empty query when there are no words", () => {
    expect(anyWordsQuery("?!")).toBe("");
  });
});
