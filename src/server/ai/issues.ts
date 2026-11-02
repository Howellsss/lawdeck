import "server-only";
import { ISSUES_PROMPT_VERSION, ISSUES_SYSTEM, parseIssues } from "@/prompts/issues";
import { failureDetails, getClaude } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";
import { recordUsage } from "./usage";

// Listing the issues must not hold up the answer for long; without them the whole question is
// still searched as before.
const ISSUES_TIMEOUT_MS = 8_000;

// Lists the legal issues in a problem question with Claude Haiku, as search phrases. Returns an
// empty list when Claude cannot be reached or replies oddly. Logs model, tokens, cost and time
// (rule G-08), never the question. `record` is false in the answer test (a marked admin job),
// which has no signed-in person to record usage for.
export async function listIssues(question: string, record = true): Promise<string[]> {
  const started = Date.now();
  try {
    const response = await getClaude().messages.create(
      {
        model: MODELS.smallJobs,
        max_tokens: 200,
        thinking: { type: "disabled" },
        system: ISSUES_SYSTEM,
        messages: [{ role: "user", content: `<problem>\n${question}\n</problem>` }],
      },
      { timeout: ISSUES_TIMEOUT_MS, maxRetries: 0 },
    );
    const reply = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const issues = parseIssues(reply);
    const cost = costUsd(response.model, response.usage);
    console.info("ai call", {
      job: "issues",
      prompt: ISSUES_PROMPT_VERSION,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      costUsd: cost,
      ms: Date.now() - started,
      issues: issues.length,
    });
    // Recorded with the routing helper's kind: a small helper call, not a question.
    if (record)
      await recordUsage({
        kind: "route",
        model: response.model,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        costUsd: cost,
        ms: Date.now() - started,
      });
    return issues;
  } catch (error) {
    console.error("ai call failed", { job: "issues", ...failureDetails(error), ms: Date.now() - started });
    return [];
  }
}
