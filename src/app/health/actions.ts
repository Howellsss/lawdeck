"use server";

import { timingSafeEqual } from "node:crypto";
import { z } from "@/lib/zod";
import { runHealthCheck, type HealthCheckResult } from "@/server/ai/healthCheck";

const Input = z.object({ code: z.string().min(1).max(200) });

// Server actions can be called by anyone, so this one requires a private test code (rule E-02)
// to stop strangers spending Claude credit.
export async function checkClaude(
  _previous: HealthCheckResult | null,
  formData: FormData,
): Promise<HealthCheckResult> {
  const parsed = Input.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { ok: false, message: "Enter the test code." };
  }
  const expected = process.env.HEALTHCHECK_CODE;
  if (!expected) {
    return { ok: false, message: "The test page is switched off. Set HEALTHCHECK_CODE on the server to use it." };
  }
  if (!sameText(parsed.data.code, expected)) {
    return { ok: false, message: "That test code is not correct." };
  }
  return runHealthCheck();
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
