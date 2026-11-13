"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { recordAcceptance, termsLinks } from "./terms";

export type TermsState = { status: "idle" | "error"; message?: string };

const acceptSchema = z.object({ agree: z.literal("yes", { error: "Tick the box to accept, then continue." }) });

// "Before you continue": records that the signed-in person accepted the current Terms and Privacy Notice.
export async function acceptTerms(_prev: TermsState, formData: FormData): Promise<TermsState> {
  const parsed = acceptSchema.safeParse({ agree: formData.get("agree") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  if (!termsLinks()) return { status: "error", message: "This isn’t switched on yet. Please refresh the page." };
  const account = await getCurrentAccount();
  if (!account) return { status: "error", message: "Please sign in again, then try once more." };
  if (!(await recordAcceptance())) return { status: "error", message: "Your acceptance wasn’t saved. Please try again." };
  refresh();
  return { status: "idle" };
}
