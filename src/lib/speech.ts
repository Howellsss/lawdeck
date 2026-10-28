import type { SpeechScope } from "@/schemas/voice";

// Turns a written answer into text for Lawdeck's voice (founder, 2026-10-28): headings and
// bullets become sentences, citation markers disappear, and legal shorthand is read the way a
// Nigerian lawyer says it ("A v. B" as "A and B", "State v. A" as "State against A",
// "s. 36" as "section 36", "(Pt. 712)" as "part 712"). Never legal content: only how to read.

const SHORT_HEADING = /^#{1,4}\s+short answer\s*:?\s*$/i;
const HEADING = /^#{1,4}\s+/;

// The part of an answer to read: all of it, its "Short answer" section, or what follows it.
// Answers without a "Short answer" heading use their first paragraph as the short answer.
export function answerScope(text: string, scope: SpeechScope): string {
  if (scope === "full") return text;
  const lines = text.split("\n");
  let start = lines.findIndex((line) => SHORT_HEADING.test(line.trim()));
  let end: number;
  if (start === -1) {
    start = lines.findIndex((line) => line.trim() && !HEADING.test(line.trim()));
    if (start === -1) return scope === "short" ? text : "";
    end = lines.findIndex((line, i) => i > start && !line.trim());
  } else {
    start += 1;
    end = lines.findIndex((line, i) => i >= start && HEADING.test(line.trim()));
  }
  if (end === -1) end = lines.length;
  return (scope === "short" ? lines.slice(start, end) : lines.slice(end)).join("\n").trim();
}

// Prosecutors: "State v. A" is read "State against A"; any other "A v. B" is "A and B".
const PROSECUTOR =
  /\b(The State|State|FRN|Federal Republic of Nigeria|Commissioner of Police|COP|Inspector[- ]General of Police|IGP|R|The Queen|The King)\s+v\.?\s+(?=[A-Z])/g;

const SPELLED = ["NWLR", "LPELR", "CFRN", "LFN", "FHC", "SC", "CA", "ACJA", "SCNJ", "NLR", "WRN", "FWLR", "AG", "SAN"];

const REPLACEMENTS: [RegExp, string][] = [
  [PROSECUTOR, "$1 against "],
  [/\s+v\.?\s+(?=[A-Z])/g, " and "],
  [/\s*&\s*Ors\b\.?/g, " and others"],
  [/\s*&\s*Anor\b\.?/g, " and another"],
  [/\s*&\s*/g, " and "],
  [/\bLtd\b\.?/g, "Limited"],
  [/\bPlc\b\.?/gi, "P.L.C."],
  [/\bss\.\s*(?=\d)/g, "sections "],
  [/\b[sS]\.\s*(?=\d)/g, "section "],
  [/\bO\.\s*(?=\d)/g, "Order "],
  [/\br\.\s*(?=\d)/g, "rule "],
  [/\bArt\.\s*(?=\d)/g, "Article "],
  [/\bparas?\.\s*(?=\d)/gi, "paragraph "],
  [/\bNo\.\s*(?=\d)/g, "number "],
  [/\(Pt\.?\s*(\d+)\)/g, "part $1"],
  [/\bPt\.?\s*(?=\d)/g, "part "],
  [/\bCAMA\b/g, "Kama"],
  [/\be\.g\.,?/gi, "for example"],
  [/\bi\.e\.,?/gi, "that is"],
  [/\betc\./gi, "et cetera"],
  [/\bviz\.,?/gi, "namely"],
  [/\bcf\./gi, "compare"],
  ...SPELLED.map((abbr): [RegExp, string] => [
    new RegExp(`\\b${abbr.replace(" ", "\\s+")}\\b`, "g"),
    abbr.split(/\s+/).map((word) => (word.length > 4 ? word : word.split("").join(".") + ".")).join(" "),
  ]),
];

function readLegal(line: string): string {
  return REPLACEMENTS.reduce((out, [pattern, value]) => out.replace(pattern, value), line);
}

// One line of the answer as a spoken sentence.
function spokenLine(raw: string): string {
  let line = raw.trim();
  if (!line) return "";
  line = line.replace(HEADING, "").replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+(?=\D)/, "");
  line = line
    .replace(/\[(S\d+)(?:\s*,\s*S\d+)*\]/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return "";
  line = readLegal(line);
  return /[.!?:;]$/.test(line) ? line : `${line}.`;
}

export function speakableText(markdown: string): string {
  return markdown
    .split("\n")
    .map(spokenLine)
    .filter(Boolean)
    .join(" ");
}

// Splits speech into parts of at most `max` characters at sentence ends, so the first part plays
// within a second or two and each request to the voice service stays small.
export function speechParts(text: string, max = 1200): string[] {
  const sentences = text.split(/(?<=[.!?:;])\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const pieces = sentence.length > max ? sentence.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [sentence] : [sentence];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 1 > max) {
        parts.push(current.trim());
        current = "";
      }
      current += `${piece.trim()} `;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type Pronunciation = { name: string; say: string };

// The voice service's request (SSML). Names on the pronunciation list are read as their
// respelling; everything else is plain, escaped text, so answer text can never act as markup.
export function speechSsml(text: string, voiceName: string, names: Pronunciation[]): string {
  let body = escapeXml(text);
  if (names.length) {
    const sorted = [...names].sort((a, b) => b.name.length - a.name.length);
    const byName = new Map(sorted.map((entry) => [entry.name.toLowerCase(), entry.say]));
    const pattern = new RegExp(`(?<![\\p{L}-])(${sorted.map((entry) => escapeRegex(escapeXml(entry.name))).join("|")})(?![\\p{L}-])`, "giu");
    body = body.replace(pattern, (match) => {
      const say = byName.get(match.toLowerCase());
      return say ? `<sub alias="${escapeXml(say)}">${match}</sub>` : match;
    });
  }
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-NG"><voice name="${escapeXml(voiceName)}">${body}</voice></speak>`;
}
