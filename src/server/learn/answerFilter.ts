import "server-only";
import { NOT_ENOUGH_MARKER } from "@/prompts/explain";

// Checks every answer before the student sees it (rules G-04 and G-05, PRD LN-04). The answer is
// checked a sentence at a time as it streams, so nothing unchecked ever reaches the screen:
// - citation markers like [S9] that point to no supplied passage are removed;
// - a case ("A v B") or a statute ("… Act", "… Law", "… Rules") that appears in no supplied
//   passage, and is not a recognised statute or rule in the library, is removed;
// - a quotation longer than 50 words is cut, unless it comes from a statute or rule of court;
// - the "not enough support" marker becomes a clear heading.

export const QUOTE_WORD_LIMIT = 50;
export const REMOVED_AUTHORITY = "[authority removed: not found in the Lawdeck library]";
export const NOT_ENOUGH_HEADING = "## Not enough in the Lawdeck library";
// Flush a long passage inside an open quotation anyway, rather than hold the stream for ever.
const MAX_HELD_CHARS = 1500;

export type FilterContext = {
  labels: Set<number>;
  // Text of every supplied passage (with headings), and of those from statutes or rules of court.
  passageTexts: string[];
  statuteTexts: string[];
  // Titles of approved statutes and rules of court in the library ("recognised statutes").
  recognisedTitles: string[];
};

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

// Lower-case words that may start a capitalised run but are not part of a name.
const LEADING_WORDS = new Set(["the", "this", "that", "these", "those", "such", "under", "in", "by", "of", "a", "an", "see", "per", "and", "following", "its", "our", "your"]);

// Names stay on one line ([ \t], not \s), so a removal never swallows the next line.
const CASE_NAME = /((?:[A-Z][\w.'&-]*[ \t]+){0,5}[A-Z][\w.'&-]*)[ \t]+v\.?[ \t]+([A-Z][\w.'&-]*(?:[ \t]+(?:[A-Z][\w.'&-]*|&|of|and)){0,5})/g;
const STATUTE_NAME = /((?:[A-Z][\w()'-]*[ \t]+){1,8}(?:Act|Law|Laws|Decree|Rules|Regulations))\b(?:,?[ \t]+(?:Cap\.?[ \t]+[\w.]+[ \t]*,?[ \t]*)?(?:19|20)\d\d)?/g;
const CITATION = /\[S(\d+)\]/g;
const QUOTE = /[“"]([^”"]{1,4000})[”"]/g;

export class AnswerFilter {
  private buffer = "";
  private started = false;
  notEnough = false;

  constructor(private readonly context: FilterContext) {}

  // Takes the next piece of the streamed answer; returns the checked text that is safe to show.
  push(chunk: string): string {
    this.buffer += chunk;
    if (!this.started) {
      const trimmed = this.buffer.trimStart();
      // Wait until we can tell whether the answer starts with the "not enough" marker.
      if (trimmed.length < NOT_ENOUGH_MARKER.length && NOT_ENOUGH_MARKER.startsWith(trimmed)) return "";
      this.started = true;
      if (trimmed.startsWith(NOT_ENOUGH_MARKER)) {
        this.notEnough = true;
        this.buffer = `${NOT_ENOUGH_HEADING}\n${trimmed.slice(NOT_ENOUGH_MARKER.length).replace(/^[\s:.-]+/, "")}`;
      }
    }
    const cut = safeBoundary(this.buffer);
    if (cut === 0) return "";
    const ready = this.buffer.slice(0, cut);
    this.buffer = this.buffer.slice(cut);
    return checkText(ready, this.context);
  }

  // The rest of the answer, checked, once the stream has ended.
  end(): string {
    if (!this.started) {
      this.started = true;
      if (this.buffer.trim() === NOT_ENOUGH_MARKER) {
        this.notEnough = true;
        this.buffer = NOT_ENOUGH_HEADING;
      }
    }
    const rest = checkText(this.buffer, this.context);
    this.buffer = "";
    return rest;
  }
}

// Words that end with a full stop without ending a sentence ("Adeyemi v. Bello", "s. 12").
const ABBREVIATIONS = new Set(["v", "vs", "s", "ss", "no", "nos", "pt", "cap", "ltd", "co", "art", "arts", "para", "paras", "r", "rr", "o", "ord", "sec", "j", "jj", "jsc", "jca", "cj", "e", "i", "eg", "ie", "etc", "nwlr", "all", "fwlr", "sc", "ca"]);

// The end of the last complete sentence (or line) in the text, outside any open quotation.
export function safeBoundary(text: string): number {
  let boundary = 0;
  const pattern = /\n|[.!?](?=\s)/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const end = match.index + match[0].length;
    if (match[0] !== "\n") {
      const word = /([A-Za-z]+)$/.exec(text.slice(0, match.index))?.[1]?.toLowerCase() ?? "";
      if (ABBREVIATIONS.has(word) || /\d$/.test(text.slice(0, match.index))) continue;
    }
    if (insideQuote(text.slice(0, end)) && text.length < MAX_HELD_CHARS) continue;
    boundary = end;
  }
  return boundary;
}

function insideQuote(text: string): boolean {
  const curlyOpen = (text.match(/“/g) ?? []).length;
  const curlyClose = (text.match(/”/g) ?? []).length;
  const straight = (text.match(/"/g) ?? []).length;
  return curlyOpen > curlyClose || straight % 2 === 1;
}

// Applies every check to a complete stretch of text.
export function checkText(text: string, context: FilterContext): string {
  const corpus = context.passageTexts.map(normalise);
  const titles = context.recognisedTitles.map(normalise).filter(Boolean);
  const inPassages = (phrase: string) => corpus.some((passage) => ` ${passage} `.includes(` ${phrase} `));

  let checked = text.replace(CITATION, (whole, n: string) => (context.labels.has(Number(n)) ? whole : ""));

  checked = checked.replace(CASE_NAME, (whole, left: string, right: string) => {
    const leftWords = normalise(left).split(" ").filter((w) => w && !LEADING_WORDS.has(w));
    const rightWords = normalise(right).split(" ").filter(Boolean);
    if (leftWords.length === 0 || rightWords.length === 0) return whole;
    const key = `${leftWords.at(-1)} v ${rightWords[0]}`;
    return inPassages(key) ? whole : `${leadingPart(left)}${REMOVED_AUTHORITY}`;
  });

  checked = checked.replace(STATUTE_NAME, (whole, name: string) => {
    const words = normalise(name).split(" ");
    while (words.length && LEADING_WORDS.has(words[0])) words.shift();
    // "The Rules", "this Law": too general to be a named authority.
    if (words.length < 2) return whole;
    const key = words.join(" ");
    if (inPassages(key) || titles.some((title) => title.includes(key) || key.includes(title))) return whole;
    return `${leadingPart(name)}${REMOVED_AUTHORITY}`;
  });

  const statutes = context.statuteTexts.map(normalise);
  checked = checked.replace(QUOTE, (whole, inner: string) => {
    const words = inner.trim().split(/\s+/);
    if (words.length <= QUOTE_WORD_LIMIT) return whole;
    if (statutes.some((passage) => passage.includes(normalise(inner)))) return whole;
    const open = whole[0];
    const close = open === "“" ? "”" : '"';
    return `${open}${words.slice(0, QUOTE_WORD_LIMIT).join(" ")} …${close}`;
  });

  return checked;
}

// Linking words before a name ("In", "See", "The") stay when the name itself is removed.
function leadingPart(run: string): string {
  let prefix = "";
  for (const word of run.split(/([ \t]+)/)) {
    if (/^[ \t]+$/.test(word)) {
      if (prefix) prefix += word;
      continue;
    }
    if (!LEADING_WORDS.has(word.toLowerCase())) break;
    prefix += word;
  }
  return prefix && !/[ \t]$/.test(prefix) ? `${prefix} ` : prefix;
}

// The passage numbers an answer actually cites, in order of first use.
export function citedLabels(text: string): number[] {
  const seen: number[] = [];
  for (const match of text.matchAll(CITATION)) {
    const n = Number(match[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}
