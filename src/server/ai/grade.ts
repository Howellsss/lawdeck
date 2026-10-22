import "server-only";
import { z } from "zod";
import { EVAL_GRADE_SCHEMA, EVAL_GRADE_SYSTEM, gradeRequest } from "@/prompts/evalGrade";
import { failureDetails, getClaude } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

const replySchema = z.object({
  pointsCovered: z.number().int().min(0),
  pushbackOk: z.boolean().nullable(),
  note: z.string(),
});

export type Grade = { pointsCovered: number; pointsTotal: number; pushbackOk: boolean | null; note: string };

// Grades one test answer with the strongest model (step 3e). Only the answer test calls this.
// Logs model, tokens, cost and time, never the text (rule G-08).
export async function gradeAnswer(input: {
  turns: { role: "user" | "assistant"; text: string }[];
  answer: string;
  mustInclude: string[];
  expect: string | null;
}): Promise<{ ok: true; grade: Grade; costUsd: number | null } | { ok: false }> {
  const started = Date.now();
  try {
    const response = await getClaude().messages.create({
      model: MODELS.documents,
      max_tokens: 4_000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: EVAL_GRADE_SCHEMA } },
      system: EVAL_GRADE_SYSTEM,
      messages: [{ role: "user", content: gradeRequest(input) }],
    });
    const cost = costUsd(response.model, response.usage);
    console.info("ai call", {
      job: "eval_grade",
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      costUsd: cost,
      ms: Date.now() - started,
      stop: response.stop_reason,
    });
    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const parsed = replySchema.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false };
    const total = input.mustInclude.length;
    return {
      ok: true,
      costUsd: cost,
      grade: {
        pointsCovered: Math.min(parsed.data.pointsCovered, total),
        pointsTotal: total,
        pushbackOk: input.expect ? parsed.data.pushbackOk : null,
        note: parsed.data.note.slice(0, 500),
      },
    };
  } catch (error) {
    console.error("ai call failed", { job: "eval_grade", ...failureDetails(error), ms: Date.now() - started });
    return { ok: false };
  }
}
