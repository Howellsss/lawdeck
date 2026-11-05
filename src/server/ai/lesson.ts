import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ExplainPassage } from "@/prompts/explain";
import {
  LESSON_PROMPT_VERSION,
  LESSON_SCHEMA,
  LESSON_SYSTEM,
  lessonRequest,
  OUTLINE_PROMPT_VERSION,
  OUTLINE_SYSTEM,
  outlineRequest,
} from "@/prompts/lesson";
import { lessonReplySchema, type LessonReply } from "@/schemas/lesson";
import { failureDetails, getClaude, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

// A lesson is long (several thousand words and its questions): Opus gets up to 4.5 minutes,
// inside the 5-minute limit of the route that asks for it (rule G-10).
const LESSON_TIMEOUT_MS = 270_000;
const OUTLINE_TIMEOUT_MS = 15_000;

export type LessonResult =
  | { ok: true; reply: LessonReply; model: string; costUsd: number | null; ms: number }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable" | "malformed" };

// Search phrases for the topic's subtopics (Haiku), used only to search the library. An empty
// list means only the topic's own name is searched.
export async function outlineTopic(course: string, topic: string): Promise<string[]> {
  const started = Date.now();
  try {
    const response = await getClaude().messages.create(
      {
        model: MODELS.smallJobs,
        max_tokens: 200,
        thinking: { type: "disabled" },
        system: OUTLINE_SYSTEM,
        messages: [{ role: "user", content: outlineRequest(course, topic) }],
      },
      { timeout: OUTLINE_TIMEOUT_MS, maxRetries: 0 },
    );
    const reply = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    console.info("ai call", {
      job: "lesson_outline",
      prompt: OUTLINE_PROMPT_VERSION,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      costUsd: costUsd(response.model, response.usage),
      ms: Date.now() - started,
    });
    return parseOutline(reply);
  } catch (error) {
    console.error("ai call failed", { job: "lesson_outline", ...failureDetails(error), ms: Date.now() - started });
    return [];
  }
}

// Writes the lesson from the supplied passages, in a fixed structure checked before use. Logs
// model, tokens, cost and time (rule G-08), never the passages or the lesson.
export async function writeLesson(input: { passages: ExplainPassage[]; course: string; topic: string }): Promise<LessonResult> {
  const started = Date.now();
  try {
    const stream = getClaude().messages.stream(
      {
        model: MODELS.lessons,
        max_tokens: 24_000,
        output_config: { effort: "medium", format: { type: "json_schema", schema: LESSON_SCHEMA } },
        system: LESSON_SYSTEM,
        messages: [{ role: "user", content: lessonRequest(input) }],
      },
      { timeout: LESSON_TIMEOUT_MS, maxRetries: 0 },
    );
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    console.info("ai call", {
      job: "lesson",
      prompt: LESSON_PROMPT_VERSION,
      model: message.model,
      tokensIn: message.usage.input_tokens,
      tokensOut: message.usage.output_tokens,
      costUsd: cost,
      ms: Date.now() - started,
      stop: message.stop_reason,
    });
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const reply = parseLessonReply(text);
    if (!reply) {
      console.warn("lesson reply malformed", { stop: message.stop_reason });
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, reply, model: message.model, costUsd: cost, ms: Date.now() - started };
  } catch (error) {
    console.error("ai call failed", { job: "lesson", ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    return { ok: false, reason: "unavailable" };
  }
}

export function parseLessonReply(text: string): LessonReply | null {
  try {
    const parsed = lessonReplySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// One search phrase per line, without bullets or numbers, no repeats, at most six.
export function parseOutline(reply: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const line of reply.split("\n")) {
    const phrase = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (phrase.length < 3 || seen.has(phrase.toLowerCase())) continue;
    seen.add(phrase.toLowerCase());
    phrases.push(phrase);
    if (phrases.length === 6) break;
  }
  return phrases;
}
