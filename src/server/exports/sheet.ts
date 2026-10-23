import type { BriefView } from "@/server/db/briefs";
import type { PracticeSetView } from "@/server/db/practice";
import type { ChatMessage } from "@/server/db/workspace";

// A study sheet (Phase 6, step 6e; PRD EX-03): notes from a chat, a brief, or a practice set as
// one simple model of headings, text and lists. The Word file and the "Save as PDF" page are both
// drawn from it, so they say the same thing. It holds only what the student already sees on
// screen: answers and the titles of their sources, never the library's passages.

export type Run = { text: string; bold?: boolean };
export type SheetBlock =
  | { kind: "heading"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "paragraph"; runs: Run[]; muted?: boolean }
  | { kind: "bullets"; items: Run[][]; muted?: boolean };
export type StudySheet = { title: string; subtitle: string; blocks: SheetBlock[] };

// Long chats or sets are cut at this many blocks so a download stays a sensible size.
export const SHEET_BLOCK_LIMIT = 4000;

// "**bold**" spans become bold runs; everything else is plain text.
export function runs(line: string): Run[] {
  const out: Run[] = [];
  line.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) out.push({ text: part.slice(2, -2), bold: true });
    else out.push({ text: part });
  });
  return out;
}

// An answer's simple formatting ("## " headings, "- " bullets, **bold**) as sheet blocks. The
// citation markers [S1] stay as written; the sources are listed underneath.
export function textBlocks(text: string): SheetBlock[] {
  const blocks: SheetBlock[] = [];
  let bullets: Run[][] = [];
  const flush = () => {
    if (bullets.length) blocks.push({ kind: "bullets", items: bullets });
    bullets = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-*] /.test(line)) {
      bullets.push(runs(line.slice(2)));
      continue;
    }
    flush();
    if (/^#{1,3} /.test(line)) blocks.push({ kind: "subheading", text: line.replace(/^#{1,3} /, "").replace(/\*\*/g, "") });
    else blocks.push({ kind: "paragraph", runs: runs(line) });
  }
  flush();
  return blocks;
}

function limited(sheet: StudySheet): StudySheet {
  if (sheet.blocks.length <= SHEET_BLOCK_LIMIT) return sheet;
  return {
    ...sheet,
    blocks: [
      ...sheet.blocks.slice(0, SHEET_BLOCK_LIMIT),
      { kind: "paragraph", runs: [{ text: "This export was shortened because it is very long." }], muted: true },
    ],
  };
}

const ORIGIN = { library: "Lawdeck library", upload: "your uploads" } as const;

export function chatSheet(chat: { title: string; courseName: string | null }, messages: ChatMessage[], when: string): StudySheet {
  const blocks: SheetBlock[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      blocks.push({ kind: "heading", text: message.text.replace(/\s+/g, " ").trim() || "Question" });
      continue;
    }
    blocks.push(...textBlocks(message.text));
    if (message.sources.length > 0)
      blocks.push({
        kind: "bullets",
        muted: true,
        items: message.sources.map((s) => [
          { text: `[S${s.label}] ${[s.itemTitle, s.heading, s.pages].filter(Boolean).join(" · ")} (${ORIGIN[s.origin ?? "library"]})` },
        ]),
      });
  }
  if (blocks.length === 0) blocks.push({ kind: "paragraph", runs: [{ text: "This chat has no messages yet." }], muted: true });
  return limited({ title: chat.title, subtitle: `Study notes · ${chat.courseName ?? "All courses"} · ${when}`, blocks });
}

export function briefSheet(brief: BriefView, when: string): StudySheet {
  const blocks: SheetBlock[] = [];
  for (const section of brief.sections) {
    blocks.push({ kind: "heading", text: section.heading });
    if (section.covered) blocks.push(...textBlocks(section.text));
    else blocks.push({ kind: "paragraph", runs: [{ text: section.text }], muted: true });
  }
  if (brief.sources.length > 0) {
    blocks.push({ kind: "heading", text: "Sources" });
    blocks.push({
      kind: "bullets",
      muted: true,
      items: brief.sources.map((s) => [{ text: `[S${s.label}] ${[s.title, s.heading, s.pages].filter(Boolean).join(" · ")}` }]),
    });
  }
  return limited({ title: brief.name, subtitle: `${brief.kind === "case" ? "Case brief" : "Statute brief"} · ${when}`, blocks });
}

const KIND_LABEL = { flashcards: "Flashcards", mcq: "Multiple choice questions", scenario: "Scenario questions" } as const;

// A practice set. Answers the student has not revealed yet stay hidden, as on screen.
export function practiceSheet(set: PracticeSetView, when: string, onlyNotKnown = false): StudySheet {
  const items = onlyNotKnown ? set.items.filter((item) => item.known !== true) : set.items;
  const blocks: SheetBlock[] = [];
  items.forEach((item, index) => {
    blocks.push({ kind: "heading", text: `${index + 1}. ${item.question.replace(/\s+/g, " ").trim()}` });
    if (item.choices) blocks.push({ kind: "bullets", items: item.choices.map((choice, i) => [{ text: `${String.fromCharCode(65 + i)}. ${choice}` }]) });
    if (!item.reveal) {
      blocks.push({ kind: "paragraph", runs: [{ text: "Answer not shown yet: answer it in Lawdeck first." }], muted: true });
      return;
    }
    const correct = item.reveal.correctChoice;
    if (item.choices && correct !== null && item.choices[correct] !== undefined)
      blocks.push({ kind: "paragraph", runs: [{ text: "Correct answer: ", bold: true }, { text: `${String.fromCharCode(65 + correct)}. ${item.choices[correct]}` }] });
    blocks.push(...textBlocks(item.reveal.answer));
    if (item.reveal.sources.length > 0)
      blocks.push({
        kind: "bullets",
        muted: true,
        items: item.reveal.sources.map((s) => [{ text: `[S${s.label}] ${[s.title, s.heading, s.pages].filter(Boolean).join(" · ")}` }]),
      });
  });
  if (blocks.length === 0)
    blocks.push({ kind: "paragraph", runs: [{ text: onlyNotKnown ? "You know every card in this set." : "This set has no questions." }], muted: true });
  const label = KIND_LABEL[set.kind] + (onlyNotKnown ? " (not known yet)" : "");
  return limited({ title: set.title, subtitle: `${label} · ${when}`, blocks });
}
