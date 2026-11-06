import { describe, expect, it } from "vitest";
import { linkMentions, messageTags, parseInline, parseMessage, plainText } from "@/lib/chatFormat";

const ADA = "00000000-0000-4000-8000-0000000007a1";

describe("chat message formatting", () => {
  it("reads bold, italic, strike, code, links, mentions and hashtags", () => {
    expect(parseInline(`**Order 3** and _rule 5_ ~~not 6~~ \`r.5\` [notes](https://example.com/n) @[Ada Obi](${ADA}) #Civil_Lit`)).toEqual([
      { t: "bold", c: [{ t: "text", v: "Order 3" }] },
      { t: "text", v: " and " },
      { t: "italic", c: [{ t: "text", v: "rule 5" }] },
      { t: "text", v: " " },
      { t: "strike", c: [{ t: "text", v: "not 6" }] },
      { t: "text", v: " " },
      { t: "code", v: "r.5" },
      { t: "text", v: " " },
      { t: "link", href: "https://example.com/n", c: [{ t: "text", v: "notes" }] },
      { t: "text", v: " " },
      { t: "mention", id: ADA, name: "Ada Obi" },
      { t: "text", v: " " },
      { t: "hashtag", tag: "civil_lit" },
    ]);
  });

  it("turns plain web addresses into links, leaving the full stop after them", () => {
    expect(parseInline("See https://mylawdeck.com/diary.")).toEqual([
      { t: "text", v: "See " },
      { t: "link", href: "https://mylawdeck.com/diary", c: [{ t: "text", v: "https://mylawdeck.com/diary" }] },
      { t: "text", v: "." },
    ]);
  });

  it("only allows web links, never javascript: or other schemes", () => {
    expect(parseInline("[x](javascript:alert(1))").some((i) => i.t === "link")).toBe(false);
  });

  it("does not read snake_case words or C# as formatting", () => {
    expect(parseInline("file_name_here and C#")).toEqual([{ t: "text", v: "file_name_here and C#" }]);
  });

  it("groups lists, quotes, code blocks and paragraphs", () => {
    const blocks = parseMessage("Steps:\n- File\n- Serve\n\n1. First\n2. Second\n> quoted\n```\nconst x = 1\n```\nBye");
    expect(blocks.map((b) => b.t)).toEqual(["p", "ul", "ol", "quote", "code", "p"]);
    expect(blocks[1]).toMatchObject({ t: "ul", items: [[{ t: "text", v: "File" }], [{ t: "text", v: "Serve" }]] });
    expect(blocks[4]).toEqual({ t: "code", v: "const x = 1" });
  });

  it("lists who is mentioned and which hashtags are used, once each", () => {
    expect(messageTags(`Hi @[Ada Obi](${ADA}) #civil #Civil\n- **#bail** too`)).toEqual({ mentions: [ADA], hashtags: ["civil", "bail"] });
  });

  it("links the names picked from the suggestions, longest first", () => {
    const text = linkMentions("@Ada Obi and @Ada, but not email@Ada", [
      { id: ADA, name: "Ada" },
      { id: "00000000-0000-4000-8000-0000000007b2", name: "Ada Obi" },
    ]);
    expect(text).toBe(`@[Ada Obi](00000000-0000-4000-8000-0000000007b2) and @[Ada](${ADA}), but not email@Ada`);
  });

  it("gives a plain one-line preview", () => {
    expect(plainText(`**Bold** _it_ [link](https://x.com) @[Ada](${ADA})\n\`code\``)).toBe("Bold it link @Ada code");
  });
});
