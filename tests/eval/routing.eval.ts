// The Auto mode routing test (PRD WS-03): at least 90% of requests go to the right mode.
// It calls Claude Haiku for each request (a fraction of a cent in total). Needs ANTHROPIC_API_KEY.
import { appendFileSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { routeRequest } from "@/server/ai/route";

const TARGET = 90;
const fileSchema = z.object({
  requests: z.array(z.object({ request: z.string().min(2), expect: z.enum(["learn", "draft"]) })).min(1),
});

describe("routing test", () => {
  it(`routes at least ${TARGET}% of requests correctly`, async () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY to run the routing test.");
    const { requests } = fileSchema.parse(JSON.parse(readFileSync("tests/eval/routing/requests.json", "utf8")));
    const misses: string[] = [];
    let unknown = 0;
    for (const item of requests) {
      const route = await routeRequest(item.request, "routing-test");
      if (route === null) unknown++;
      // Unknown counts as Learn, as it does in the app.
      if ((route ?? "learn") !== item.expect) misses.push(`${item.expect}: ${item.request}`);
    }
    const correct = requests.length - misses.length;
    const percent = Math.round((correct / requests.length) * 1000) / 10;
    const lines = [
      `Routing test: ${correct}/${requests.length} correct (${percent}%), target ${TARGET}%`,
      `No answer from Claude (treated as Learn): ${unknown}`,
      ...misses.map((miss) => `Missed (expected ${miss})`),
    ];
    console.info(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.map((l) => `- ${l}`).join("\n") + "\n");
    expect(percent).toBeGreaterThanOrEqual(TARGET);
  });
});
