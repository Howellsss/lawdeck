import "server-only";
import { parseRoute, ROUTE_PROMPT_VERSION, ROUTE_SYSTEM, type Route } from "@/prompts/route";
import { failureDetails, getClaude } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

// Routing must feel instant; if it takes longer, the request is treated as Learn.
const ROUTE_TIMEOUT_MS = 8_000;

// Decides whether an Auto mode request is for Learn or Draft (PRD WS-03), with Claude Haiku.
// Returns null when Claude cannot be reached or replies oddly; callers then use Learn.
// Logs model, tokens, cost and time (rule G-08), never the request.
export async function routeRequest(request: string, userId: string): Promise<Route | null> {
  const started = Date.now();
  try {
    const response = await getClaude().messages.create(
      {
        model: MODELS.routing,
        max_tokens: 5,
        thinking: { type: "disabled" },
        system: ROUTE_SYSTEM,
        messages: [{ role: "user", content: `<request>\n${request}\n</request>` }],
      },
      { timeout: ROUTE_TIMEOUT_MS, maxRetries: 0 },
    );
    const reply = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const route = parseRoute(reply);
    console.info("ai call", {
      job: "route",
      prompt: ROUTE_PROMPT_VERSION,
      userId,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      costUsd: costUsd(response.model, response.usage),
      ms: Date.now() - started,
      route: route ?? "unknown",
    });
    return route;
  } catch (error) {
    console.error("ai call failed", { job: "route", userId, ...failureDetails(error), ms: Date.now() - started });
    return null;
  }
}
