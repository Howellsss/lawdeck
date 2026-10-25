import "server-only";
import { NOT_ENOUGH_MARKER } from "@/prompts/explain";

// Checks every answer before the student sees it (rules G-04 and G-05, PRD LN-04). The answer is
// checked a sentence at a time as it streams, so nothing unchecked ever reaches the screen:
// - citation markers like [S9] that point to no supplied passage are removed;
// - a case ("A v B") or a statute ("… Act", "… Law", "… Rules") that appears in no supplied
//   passage, is not a recognised statute or rule, and is not found anywhere else in the approved
//   library (the lookup below), is removed;
// - a quotation longer than 50 words is cut, unless it comes from a statute or rule of court;
// - the "not enough support" marker becomes a clear heading.

export const QUOTE_WORD_LIMIT = 50;
export const REMOVED_AUTHORITY =
  "[authority removed: not found in the Lawdeck library]";
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
  // Asks the whole approved library about names not found above; returns the keys it found.
  // Without it (or if it fails) only the passages and titles count, so nothing unchecked shows.
  lookup?: LibraryLookup;
};

// Normalised names, as checkText builds them: "lagos state civil procedure rules", "kolawole v alberto".
export type AuthorityKeys = { statutes: string[]; cases: string[] };
export type LibraryLookup = (keys: AuthorityKeys) => Promise<Set<string>>;

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

// Lower-case words that may start a capitalised run but are not part of a name.
const LEADING_WORDS = new Set([
  "the",
  "this",
  "that",
  "these",
  "those",
  "such",
  "under",
  "in",
  "by",
  "of",
  "a",
  "an",
  "see",
  "per",
  "and",
  "following",
  "its",
  "our",
  "your",
]);

// Names stay on one line ([ \t], not \s), so a removal never swallows the next line.
const CASE_NAME =
  /((?:(?:[A-Z][\w.'&-]*|&)[ \t]+){0,5}[A-Z][\w.'&-]*)[ \t]+v\.?[ \t]+([A-Z][\w.'&-]*(?:[ \t]+(?:[A-Z][\w.'&-]*|&|of|and)){0,5})/g;
// A statute name runs through "of", "and" and brackets: "High Court of Lagos State (Civil Procedure) Rules".
const STATUTE_NAME =
  /((?:[A-Z][\w()'-]*[ \t]+)(?:(?:\(?[A-Z][\w()'-]*|of|and)[ \t]+){0,10}(?:Act|Law|Laws|Decree|Rules|Regulations))\b(?:,?[ \t]+(?:Cap\.?[ \t]+[\w.]+[ \t]*,?[ \t]*)?(?:19|20)\d\d)?/g;
const CITATION = /\[S(\d+)\]/g;
const QUOTE = /[“"]([^”"]{1,4000})[”"]/g;

export class AnswerFilter {
  private buffer = "";
  private started = false;
  notEnough = false;

  constructor(private readonly context: FilterContext) {}

  // Takes the next piece of the streamed answer; returns the checked text that is safe to show.
  // Call it in order and wait for each result, so the answer keeps its order.
  async push(chunk: string): Promise<string> {
    this.buffer += chunk;
    if (!this.started) {
      const trimmed = this.buffer.trimStart();
      // Wait until we can tell whether the answer starts with the "not enough" marker.
      if (
        trimmed.length < NOT_ENOUGH_MARKER.length &&
        NOT_ENOUGH_MARKER.startsWith(trimmed)
      )
        return "";
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
    return checkWithLibrary(ready, this.context);
  }

  // The rest of the answer, checked, once the stream has ended.
  async end(): Promise<string> {
    if (!this.started) {
      this.started = true;
      if (this.buffer.trim() === NOT_ENOUGH_MARKER) {
        this.notEnough = true;
        this.buffer = NOT_ENOUGH_HEADING;
      }
    }
    const rest = this.buffer;
    this.buffer = "";
    return checkWithLibrary(rest, this.context);
  }
}

// Words that end with a full stop without ending a sentence ("Adeyemi v. Bello", "s. 12").
const ABBREVIATIONS = new Set([
  "v",
  "vs",
  "s",
  "ss",
  "no",
  "nos",
  "pt",
  "cap",
  "ltd",
  "co",
  "art",
  "arts",
  "para",
  "paras",
  "r",
  "rr",
  "o",
  "ord",
  "sec",
  "j",
  "jj",
  "jsc",
  "jca",
  "cj",
  "e",
  "i",
  "eg",
  "ie",
  "etc",
  "nwlr",
  "all",
  "fwlr",
  "sc",
  "ca",
]);

// The end of the last complete sentence (or line) in the text, outside any open quotation.
export function safeBoundary(text: string): number {
  let boundary = 0;
  const pattern = /\n|[.!?](?=\s)/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const end = match.index + match[0].length;
    if (match[0] !== "\n") {
      const word =
        /([A-Za-z]+)$/.exec(text.slice(0, match.index))?.[1]?.toLowerCase() ??
        "";
      if (ABBREVIATIONS.has(word) || /\d$/.test(text.slice(0, match.index)))
        continue;
    }
    if (insideQuote(text.slice(0, end)) && text.length < MAX_HELD_CHARS)
      continue;
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

// Words in a party's name that do not identify the case: "Madukolu & Ors v Nkemdilim" is
// "Madukolu v Nkemdilim". They are left out of case keys and of the passages they are matched in,
// so a case written with or without them is still recognised.
const PARTY_FILLER = new Set(["ors", "anor", "others", "another", "ltd", "plc", "limited"]);

function withoutFiller(text: string): string {
  return text
    .split(" ")
    .filter((w) => w && !PARTY_FILLER.has(w))
    .join(" ");
}

// The case and statute keys in a stretch of text, with the part of the text each came from.
function caseKey(left: string, right: string): string | null {
  // A party named only by filler ("Ors v Musa") keeps it, so it is checked, never waved through.
  const party = (name: string) => withoutFiller(normalise(name)) || normalise(name);
  const leftWords = party(left)
    .split(" ")
    .filter((w) => w && !LEADING_WORDS.has(w));
  const rightWords = party(right).split(" ").filter(Boolean);
  if (leftWords.length === 0 || rightWords.length === 0) return null;
  return `${leftWords.at(-1)} v ${rightWords[0]}`;
}

function statuteKey(name: string): string | null {
  const words = normalise(name).split(" ");
  while (words.length && LEADING_WORDS.has(words[0])) words.shift();
  // "The Rules", "this Law": too general to be a named authority.
  return words.length < 2 ? null : words.join(" ");
}

function knownLocally(context: FilterContext) {
  const corpus = context.passageTexts.map(normalise);
  const caseCorpus = corpus.map(withoutFiller);
  const titles = context.recognisedTitles.map(normalise).filter(Boolean);
  const inPassages = (phrase: string) =>
    corpus.some((passage) => ` ${passage} `.includes(` ${phrase} `));
  return {
    isCase: (key: string) =>
      caseCorpus.some((passage) => ` ${passage} `.includes(` ${key} `)),
    isStatute: (key: string) =>
      inPassages(key) ||
      titles.some((title) => title.includes(key) || key.includes(title)),
  };
}

// The names in the text that the supplied passages and recognised titles do not account for.
export function unmatchedAuthorities(
  text: string,
  context: FilterContext,
): AuthorityKeys {
  const known = knownLocally(context);
  const cases = new Set<string>();
  const statutes = new Set<string>();
  for (const match of text.matchAll(CASE_NAME)) {
    const key = caseKey(match[1], match[2]);
    if (key && !known.isCase(key)) cases.add(key);
  }
  for (const match of text.matchAll(STATUTE_NAME)) {
    const key = statuteKey(match[1]);
    if (key && !known.isStatute(key)) statutes.add(key);
  }
  return { statutes: [...statutes], cases: [...cases] };
}

// checkText, after asking the whole library about names the passages do not account for.
export async function checkWithLibrary(
  text: string,
  context: FilterContext,
): Promise<string> {
  if (!context.lookup) return checkText(text, context);
  const keys = unmatchedAuthorities(text, context);
  if (keys.statutes.length === 0 && keys.cases.length === 0)
    return checkText(text, context);
  let found = new Set<string>();
  try {
    found = await context.lookup(keys);
  } catch {
    // Could not ask the library: keep the strict check (remove), never show an unchecked name.
    console.warn("citation check lookup failed");
  }
  return checkText(text, context, found);
}

// Applies every check to a complete stretch of text. Names in foundInLibrary were found by the
// whole-library lookup and stay.
export function checkText(
  text: string,
  context: FilterContext,
  foundInLibrary: Set<string> = new Set(),
): string {
  const known = knownLocally(context);

  let checked = text.replace(CITATION, (whole, n: string) =>
    context.labels.has(Number(n)) ? whole : "",
  );

  checked = checked.replace(CASE_NAME, (whole, left: string, right: string) => {
    const key = caseKey(left, right);
    if (!key || known.isCase(key) || foundInLibrary.has(key)) return whole;
    return `${leadingPart(left)}${REMOVED_AUTHORITY}`;
  });

  checked = checked.replace(STATUTE_NAME, (whole, name: string) => {
    const key = statuteKey(name);
    if (!key || known.isStatute(key) || foundInLibrary.has(key)) return whole;
    return `${leadingPart(name)}${REMOVED_AUTHORITY}`;
  });

  const statutes = context.statuteTexts.map(normalise);
  checked = checked.replace(QUOTE, (whole, inner: string) => {
    const words = inner.trim().split(/\s+/);
    if (words.length <= QUOTE_WORD_LIMIT) return whole;
    if (statutes.some((passage) => passage.includes(normalise(inner))))
      return whole;
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
