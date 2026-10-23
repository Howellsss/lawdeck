import "server-only";
import { DRAFT_PICK_PROMPT_VERSION, DRAFT_PICK_SYSTEM, draftPickRequest, parsePick } from "@/prompts/draftPick";
import { failureDetails, getClaude } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";
import { recordUsage } from "./usage";

// Matching must feel instant; if it takes longer, the student chooses from the catalogue.
const PICK_TIMEOUT_MS = 8_000;

// Matches a typed drafting request ("Draft a writ of summons") to one approved template, with
// Claude Haiku (PRD DR-02). Only the template titles and the cleaned request are sent. Returns the
// list position, or null when nothing matches or Claude cannot be reached. Logs model, tokens,
// cost and time (rule G-08), never the request; matching is recorded but does not count as a question.
export async function pickTemplate(request: string, titles: string[], userId: string): Promise<number | null> {
  if (titles.length === 0) return null;
  const started = Date.now();
  try {
    const response = await getClaude().messages.create(
      {
        model: MODELS.smallJobs,
        max_tokens: 8,
        thinking: { type: "disabled" },
        system: DRAFT_PICK_SYSTEM,
        messages: [{ role: "user", content: draftPickRequest(request, titles) }],
      },
      { timeout: PICK_TIMEOUT_MS, maxRetries: 0 },
    );
    const reply = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const picked = parsePick(reply, titles.length);
    const cost = costUsd(response.model, response.usage);
    const ms = Date.now() - started;
    console.info("ai call", {
      job: "draft_pick",
      prompt: DRAFT_PICK_PROMPT_VERSION,
      userId,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      costUsd: cost,
      ms,
      matched: picked !== null,
    });
    await recordUsage({
      kind: "draft_pick",
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      costUsd: cost,
      ms,
    });
    return picked;
  } catch (error) {
    console.error("ai call failed", { job: "draft_pick", userId, ...failureDetails(error), ms: Date.now() - started });
    return null;
  }
}
