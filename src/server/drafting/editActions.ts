"use server";

import { editFactsSchema, editPartSchema, instructionSchema, versionRefSchema } from "@/schemas/drafting";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { DocModel } from "@/server/documents/render";
import { instruct, restoreVersion, saveFacts, savePart, versionModel, type EditResult, type InstructResult } from "./edit";

// Actions for changing a document (step 5e). Input is checked with Zod and sign-in on the server;
// row-level security limits every read and new version to the document's owner.

const SIGN_IN = { ok: false as const, message: "Sign in to change your documents." };

export async function changeFacts(input: unknown): Promise<EditResult> {
  const parsed = editFactsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the facts and try again." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  return saveFacts(await createSupabaseServerClient(), parsed.data.documentId, parsed.data.facts);
}

export async function changePart(input: unknown): Promise<EditResult> {
  const parsed = editPartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the wording and try again." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  return savePart(await createSupabaseServerClient(), parsed.data.documentId, parsed.data.partId, parsed.data.text);
}

export async function changeByInstruction(input: unknown): Promise<InstructResult> {
  const parsed = instructionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Say what to change." };
  const account = await getCurrentAccount();
  if (!account) return SIGN_IN;
  return instruct(await createSupabaseServerClient(), account.id, parsed.data.documentId, parsed.data.instruction);
}

export async function makeVersionCurrent(input: unknown): Promise<EditResult> {
  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That version could not be found." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  return restoreVersion(await createSupabaseServerClient(), parsed.data.documentId, parsed.data.versionId);
}

export async function showVersion(input: unknown): Promise<{ ok: true; model: DocModel; number: number } | { ok: false; message: string }> {
  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That version could not be found." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  return versionModel(await createSupabaseServerClient(), parsed.data.documentId, parsed.data.versionId);
}
