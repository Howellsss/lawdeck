import { describe, expect, it } from "vitest";
import { SentenceSplitter } from "@/lib/sentences";

describe("splitting a streamed reply into sentences", () => {
  it("returns each sentence as soon as it is complete", () => {
    const split = new SentenceSplitter();
    expect(split.push("Hey! Doing ")).toEqual(["Hey!"]);
    expect(split.push("well, thanks. What are we")).toEqual(["Doing well, thanks."]);
    expect(split.push(" working on today?")).toEqual([]);
    expect(split.end()).toEqual(["What are we working on today?"]);
  });

  it("does not split numbers or section references mid-sentence", () => {
    const split = new SentenceSplitter();
    expect(split.push("See section 36(6) of the Constitution [S1]. It applies in 2.5 cases")).toEqual([
      "See section 36(6) of the Constitution [S1].",
    ]);
    expect(split.end()).toEqual(["It applies in 2.5 cases"]);
  });

  it("treats a line break as the end of a sentence", () => {
    const split = new SentenceSplitter();
    expect(split.push("First point\nSecond")).toEqual(["First point"]);
    expect(split.end()).toEqual(["Second"]);
  });

  it("does not end a sentence at a legal abbreviation", () => {
    const split = new SentenceSplitter();
    expect(split.push("Under s. 36 of the Act, see Agbonmagbe Bank Ltd. v. Ollivant. Next ")).toEqual([
      "Under s. 36 of the Act, see Agbonmagbe Bank Ltd. v. Ollivant.",
    ]);
  });

  it("can start with the first long clause, so speech begins sooner", () => {
    const split = new SentenceSplitter({ quickStart: true });
    expect(split.push("Yes")).toEqual([]);
    expect(split.push(", I can help with originating processes, and the")).toEqual(["Yes, I can help with originating processes,"]);
    expect(split.push(" pleadings. Next, a short one, ok")).toEqual(["and the pleadings."]);
    expect(split.end()).toEqual(["Next, a short one, ok"]);
  });
});
