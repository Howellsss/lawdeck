// Campus chat messages (docs/specs/chat.md): a small Markdown-like set, read by Lawdeck's own parser
// and drawn as React elements (never as raw HTML), so a message can never inject markup.
//   **bold**  _italic_  ~~strike~~  `code`  [text](https://link)  plain https:// links
//   - bullet   1. numbered   > quote   ``` code block ```
//   @[Name](person id) mentions and #hashtags.

export type Inline =
  | { t: "text"; v: string }
  | { t: "bold" | "italic" | "strike"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "mention"; id: string; name: string }
  | { t: "hashtag"; tag: string };

export type Block =
  | { t: "p"; lines: Inline[][] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "quote"; lines: Inline[][] }
  | { t: "code"; v: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const INLINE = new RegExp(
  [
    "`([^`\\n]+)`", // 1 code
    `@\\[([^\\]\\n]{1,80})\\]\\((${UUID})\\)`, // 2 name, 3 id
    "\\[([^\\]\\n]{1,200})\\]\\((https?:\\/\\/[^\\s)]{1,500})\\)", // 4 label, 5 href
    "\\*\\*([^*\\n]+?)\\*\\*", // 6 bold
    "~~([^~\\n]+?)~~", // 7 strike
    "(?<![\\w])_([^_\\n]+?)_(?![\\w])", // 8 italic
    "(https?:\\/\\/[^\\s<>()]{2,500}[^\\s<>().,;:!?'\"])", // 9 plain link
    "(?<![\\w#])#([A-Za-z0-9_]{1,40})", // 10 hashtag
  ].join("|"),
  "g",
);

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > at) out.push({ t: "text", v: text.slice(at, start) });
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "mention", name: m[2], id: m[3] });
    else if (m[4] !== undefined) out.push({ t: "link", href: m[5], c: parseInline(m[4]) });
    else if (m[6] !== undefined) out.push({ t: "bold", c: parseInline(m[6]) });
    else if (m[7] !== undefined) out.push({ t: "strike", c: parseInline(m[7]) });
    else if (m[8] !== undefined) out.push({ t: "italic", c: parseInline(m[8]) });
    else if (m[9] !== undefined) out.push({ t: "link", href: m[9], c: [{ t: "text", v: m[9] }] });
    else if (m[10] !== undefined) out.push({ t: "hashtag", tag: m[10].toLowerCase() });
    at = start + m[0].length;
  }
  if (at < text.length) out.push({ t: "text", v: text.slice(at) });
  return out;
}

export function parseMessage(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) code.push(lines[i]);
      blocks.push({ t: "code", v: code.join("\n") });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line);
    const quote = /^\s*>\s?(.*)$/.exec(line);
    const last = blocks.at(-1);
    if (bullet) {
      if (last?.t === "ul") last.items.push(parseInline(bullet[1]));
      else blocks.push({ t: "ul", items: [parseInline(bullet[1])] });
    } else if (numbered) {
      if (last?.t === "ol") last.items.push(parseInline(numbered[1]));
      else blocks.push({ t: "ol", items: [parseInline(numbered[1])] });
    } else if (quote) {
      if (last?.t === "quote") last.lines.push(parseInline(quote[1]));
      else blocks.push({ t: "quote", lines: [parseInline(quote[1])] });
    } else if (line.trim() === "") {
      blocks.push({ t: "p", lines: [] });
    } else if (last?.t === "p" && last.lines.length > 0) {
      last.lines.push(parseInline(line));
    } else {
      blocks.push({ t: "p", lines: [parseInline(line)] });
    }
  }
  return blocks.filter((b) => b.t !== "p" || b.lines.length > 0);
}

// What a message is about, for the database: the people it @mentions and its #hashtags.
export function messageTags(body: string): { mentions: string[]; hashtags: string[] } {
  const mentions = new Set<string>();
  const hashtags = new Set<string>();
  const walk = (items: Inline[]) => {
    for (const item of items) {
      if (item.t === "mention") mentions.add(item.id);
      else if (item.t === "hashtag") hashtags.add(item.tag);
      else if (item.t === "bold" || item.t === "italic" || item.t === "strike" || item.t === "link") walk(item.c);
    }
  };
  for (const block of parseMessage(body)) {
    if (block.t === "p" || block.t === "quote") block.lines.forEach(walk);
    else if (block.t === "ul" || block.t === "ol") block.items.forEach(walk);
  }
  return { mentions: [...mentions].slice(0, 20), hashtags: [...hashtags].slice(0, 20) };
}

// The composer shows "@Ada Obi"; before sending, each name picked from the suggestions becomes
// @[Ada Obi](id). Longer names first, so "@Ada Obi" is not taken for "@Ada".
export function linkMentions(text: string, picked: { id: string; name: string }[]): string {
  let out = text;
  for (const person of [...picked].sort((a, b) => b.name.length - a.name.length)) {
    const escaped = person.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|[^\\[\\w])@${escaped}(?![\\w])`, "g"), `$1@[${person.name}](${person.id})`);
  }
  return out;
}

// Plain words of a message, for a one-line preview (search results, notifications).
export function plainText(body: string): string {
  return body
    .replace(new RegExp(`@\\[([^\\]]+)\\]\\(${UUID}\\)`, "g"), "@$1")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/(\*\*|~~|`{1,3})/g, "")
    .replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
