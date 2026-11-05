import type { ExtrasReply } from "@/schemas/extras";

// Lawdeck's own limits on memory aids and stories (docs/specs/remembrance.md, Phase 2), applied
// in code rather than left to the AI: calm (one aid per section, about four aids and three
// stories a lesson), accurate (an acronym's letters must be its items' letters, in order), and
// never invented (a case story only for an authority whose facts the library gives).
export const MAX_AIDS = 4;
export const MAX_STORIES = 3;

type Aid = ExtrasReply["memory_aids"][number];
type Story = ExtrasReply["stories"][number];
export type LessonAuthorityRef = { key: string; factsFromLibrary: boolean };

// The letters of an acronym, e.g. "C.O.C.L.I." or "Cocli" -> "COCLI".
export function acronymLetters(device: string): string {
  return device.toUpperCase().replace(/[^A-Z]/g, "");
}

// An acronym is kept only if each item is one letter and together they spell the acronym.
export function acronymMatches(aid: Pick<Aid, "device" | "items">): boolean {
  const letters = acronymLetters(aid.device);
  if (letters.length < 2 || aid.items.length !== letters.length) return false;
  return aid.items.every((item, i) => acronymLetters(item.key) === letters[i]);
}

export function selectAids(aids: Aid[], lastSection: number): { kept: Aid[]; dropped: number } {
  const kept: Aid[] = [];
  const used = new Set<number>();
  let dropped = 0;
  for (const aid of aids) {
    const section = Math.min(aid.after_section, lastSection);
    const bad = aid.items.length === 0 || (aid.kind === "acronym" && !acronymMatches(aid));
    if (bad || used.has(section) || kept.length >= MAX_AIDS) {
      dropped += 1;
      continue;
    }
    used.add(section);
    kept.push({ ...aid, after_section: section });
  }
  kept.sort((a, b) => a.after_section - b.after_section);
  return { kept, dropped };
}

export function selectStories(stories: Story[], lastSection: number, authorities: LessonAuthorityRef[]): { kept: Story[]; dropped: number } {
  const byKey = new Map(authorities.map((a) => [a.key, a]));
  const kept: Story[] = [];
  let dropped = 0;
  for (const story of stories) {
    const authority = story.authority ? byKey.get(story.authority) : undefined;
    // A case story retells a reported case, so the library must give its facts.
    if ((story.kind === "case" && !authority?.factsFromLibrary) || kept.length >= MAX_STORIES) {
      dropped += 1;
      continue;
    }
    const questionOk = story.question.length > 0 && story.choices.length >= 2 && story.correct_choice >= 0 && story.correct_choice < story.choices.length;
    kept.push({
      ...story,
      after_section: Math.min(story.after_section, lastSection),
      authority: authority ? story.authority : "",
      question: questionOk ? story.question : "",
      choices: questionOk ? story.choices : [],
      correct_choice: questionOk ? story.correct_choice : -1,
      explanation: questionOk ? story.explanation : "",
    });
  }
  kept.sort((a, b) => a.after_section - b.after_section);
  return { kept, dropped };
}
