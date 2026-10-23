import { describe, expect, it } from "vitest";
import { paginate } from "@/lib/paginate";

describe("splitting a document into pages", () => {
  it("fills each page before starting the next", () => {
    expect(paginate([{ height: 40 }, { height: 40 }, { height: 40 }], 100)).toEqual([[0, 1], [2]]);
  });

  it("keeps a heading with the paragraph after it", () => {
    const items = [{ height: 70 }, { height: 10, keepWithNext: true }, { height: 30 }];
    expect(paginate(items, 100)).toEqual([[0], [1, 2]]);
  });

  it("starts a new page where asked (after a cover page)", () => {
    expect(paginate([{ height: 10 }, { height: 10, newPage: true }, { height: 10 }], 100)).toEqual([[0], [1, 2]]);
  });

  it("gives an item taller than a page a page of its own", () => {
    expect(paginate([{ height: 10 }, { height: 250 }, { height: 10 }], 100)).toEqual([[0], [1], [2]]);
  });

  it("always returns at least one page", () => {
    expect(paginate([], 100)).toEqual([[]]);
  });
});
