import "server-only";
import type { PracticeQuestionKind } from "@/prompts/practice";
import type { PracticeReply } from "@/schemas/practice";
import { checkWithLibrary, REMOVED_AUTHORITY, type FilterContext } from "@/server/learn/answerFilter";

export type CleanItem = {
  question: string;
  choices: string[] | null;
  correctChoice: number | null;
  answer: string;
  // Passage labels the item relies on, in order, each one supplied.
  sources: number[];
};

// Keeps only questions Lawdeck can stand behind (exit check: questions cite only library
// material). An item is dropped if it cites no supplied passage, has the wrong shape for its
// kind, or names an authority the citation check cannot find in the library. Citation markers
// to passages that were not supplied are removed, and long quotations are cut, as in answers.
export async function cleanPracticeItems(
  reply: PracticeReply,
  kind: PracticeQuestionKind,
  count: number,
  context: FilterContext,
): Promise<{ items: CleanItem[]; dropped: number }> {
  const items: CleanItem[] = [];
  let dropped = 0;
  for (const raw of reply.items) {
    if (items.length >= count) break;
    const sources = [...new Set(raw.sources)].filter((label) => context.labels.has(label));
    const shapeOk =
      kind === "mcq"
        ? raw.choices.length >= 2 && raw.choices.length <= 6 && raw.correctChoice >= 0 && raw.correctChoice < raw.choices.length
        : raw.choices.length === 0;
    if (sources.length === 0 || !shapeOk) {
      dropped++;
      continue;
    }
    const [question, answer, ...choices] = await Promise.all(
      [raw.question, raw.answer, ...(kind === "mcq" ? raw.choices : [])].map((text) => checkWithLibrary(text, context)),
    );
    if ([question, answer, ...choices].some((text) => text.includes(REMOVED_AUTHORITY) || !text.trim())) {
      dropped++;
      continue;
    }
    items.push({
      question: question.trim(),
      choices: kind === "mcq" ? choices.map((choice) => choice.trim()) : null,
      correctChoice: kind === "mcq" ? raw.correctChoice : null,
      answer: answer.trim(),
      sources,
    });
  }
  return { items, dropped };
}
