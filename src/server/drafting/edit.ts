import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitReachedMessage } from "@/lib/allowance";
import { documentContentSchema, factsFor, type DocumentContent, type TemplateSpec } from "@/schemas/drafting";
import { editDraftParts, type DraftEditReply } from "@/server/ai/draft";
import { recordUsage } from "@/server/ai/usage";
import { loadDocument } from "@/server/db/documents";
import type { Database } from "@/server/db/types";
import { sameJson } from "@/server/documents/plan";
import { buildDocument, type DocModel } from "@/server/documents/render";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "@/server/learn/allowance";
import { checkWithLibrary } from "@/server/learn/answerFilter";
import { libraryOnlyContext } from "@/server/learn/filterContext";
import { redactPersonalData } from "@/server/learn/redact";
import { cleanPart, factsForClaude, hiddenDetails, maskDetails } from "./standIns";

// Editing a document (step 5e, PRD DR-05): facts and wording changed by hand, changes by
// instruction, and going back to an earlier version. Every saved change is a new numbered version;
// nothing is ever overwritten. Row-level security keeps all of it to the document's owner.

type Db = SupabaseClient<Database>;
export type EditResult = { ok: true; changed: boolean } | { ok: false; message: string };

const NOT_FOUND = "That document could not be found.";
const RECHECKING = "This document is being re-checked, so it can’t be changed just now. Your facts and text are saved.";
const NOT_SAVED = "The change was not saved. Please try again.";

type Loaded = NonNullable<Awaited<ReturnType<typeof loadDocument>>>;
type Editable = Omit<Loaded, "layout" | "content" | "spec" | "model"> & {
  layout: NonNullable<Loaded["layout"]>;
  content: DocumentContent;
  spec: TemplateSpec;
  model: DocModel;
};

// One of the student's own documents, ready to change: only while its template and court are
// approved (unreviewed wording is never shown).
async function editable(db: Db, id: string): Promise<Editable | { ok: false; message: string }> {
  let loaded: Awaited<ReturnType<typeof loadDocument>>;
  try {
    loaded = await loadDocument(db, id);
  } catch {
    return { ok: false, message: "The document could not be loaded. Please try again." };
  }
  if (!loaded) return { ok: false, message: NOT_FOUND };
  const { layout, content, spec, model } = loaded;
  if (!model || !layout || !spec || !content) return { ok: false, message: RECHECKING };
  return { ...loaded, layout, content, spec, model };
}

async function saveVersion(db: Db, documentId: string, content: DocumentContent, by: "student" | "ai", model: string | null): Promise<boolean> {
  const { error } = await db.from("document_versions").insert({
    document_id: documentId,
    content: documentContentSchema.parse(content),
    created_by: by,
    model,
  });
  if (error) console.error("document edit failed", { step: "version", code: error.code });
  return !error;
}

// The facts (intake answers), changed by hand. Only the template's own fields are kept.
export async function saveFacts(db: Db, id: string, facts: Record<string, string | string[]>): Promise<EditResult> {
  const doc = await editable(db, id);
  if ("ok" in doc) return doc;
  const checked = factsFor(doc.spec, facts);
  if (!checked.ok) return checked;
  if (sameJson(checked.fields, doc.content.fields)) return { ok: true, changed: false };
  const saved = await saveVersion(db, id, { ...doc.content, fields: checked.fields }, "student", null);
  return saved ? { ok: true, changed: true } : { ok: false, message: NOT_SAVED };
}

// One part's wording, rewritten by hand, or put back (text null) to the template's or Lawdeck's wording.
export async function savePart(db: Db, id: string, partId: string, text: string | null): Promise<EditResult> {
  const doc = await editable(db, id);
  if ("ok" in doc) return doc;
  const block = doc.model.blocks.find((b) => b.partId === partId);
  if (!block || block.kind === "signature") return { ok: false, message: "That part can’t be changed here." };
  const edits = { ...doc.content.edits };
  if (text === null) delete edits[partId];
  else edits[partId] = text.trim();
  if (sameJson(edits, doc.content.edits)) return { ok: true, changed: false };
  const saved = await saveVersion(db, id, { ...doc.content, edits }, "student", null);
  return saved ? { ok: true, changed: true } : { ok: false, message: NOT_SAVED };
}

// Makes an earlier version the current one again. Later versions are kept, never deleted.
export async function restoreVersion(db: Db, id: string, versionId: string): Promise<EditResult> {
  const version = await db.from("document_versions").select("id").eq("id", versionId).eq("document_id", id).maybeSingle();
  if (version.error || !version.data) return { ok: false, message: "That version could not be found." };
  const { error } = await db.from("documents").update({ current_version_id: versionId }).eq("id", id);
  if (error) {
    console.error("document edit failed", { step: "restore", code: error.code });
    return { ok: false, message: "The version was not restored. Please try again." };
  }
  return { ok: true, changed: true };
}

// An earlier version drawn for the preview, without making it current.
export async function versionModel(db: Db, id: string, versionId: string): Promise<{ ok: true; model: DocModel; number: number } | { ok: false; message: string }> {
  const doc = await editable(db, id);
  if ("ok" in doc) return doc;
  const version = await db.from("document_versions").select("number, content").eq("id", versionId).eq("document_id", id).maybeSingle();
  if (version.error || !version.data) return { ok: false, message: "That version could not be found." };
  const content = documentContentSchema.safeParse(version.data.content);
  if (!content.success) return { ok: false, message: "That version could not be shown." };
  return { ok: true, model: buildDocument({ ...doc.layout, content: content.data }), number: version.data.number };
}

export type AskFor = { field: string; label: string; addAnother: boolean };
export type InstructResult = { ok: true; changed: boolean; note: string; askFor: AskFor[] } | { ok: false; message: string };

const FAILURES = {
  no_key: "Changes by instruction are not switched on yet: the Claude key is missing on the server.",
  busy: "Lawdeck is busy right now. Please try again in a minute.",
  refused: "Lawdeck can’t make that change. Try saying it another way, or edit the part by hand.",
  unavailable: "Lawdeck could not reach the drafting service. Please try again in a minute.",
  malformed: "Lawdeck could not make the change this time. Please try again.",
} as const;

// A change by instruction ("add a second defendant"): Opus rewrites narrative parts only, with
// names and addresses as stand-ins (rule G-06); new facts are asked of the student, never written
// by the AI. Counts as one question (founder, 2026-10-23) once Claude has answered.
export async function instruct(db: Db, userId: string, id: string, instruction: string): Promise<InstructResult> {
  const doc = await editable(db, id);
  if ("ok" in doc) return doc;

  const allowance = await getAllowance(db);
  if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
  if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };

  const hidden = hiddenDetails(doc.spec, doc.content.fields);
  const mask = (text: string) => redactPersonalData(maskDetails(text, hidden));
  const editableParts = doc.model.blocks
    .filter((block) => block.kind === "narrative")
    .map((block) => doc.spec.parts.find((part) => part.id === block.partId))
    .filter((part) => part !== undefined)
    .map((part) => ({
      id: part.id,
      heading: part.heading ?? null,
      purpose: part.instruction ?? part.why,
      maxWords: part.maxWords ?? 200,
      text: mask(doc.content.edits[part.id] ?? doc.content.narrative[part.id] ?? ""),
    }));

  const result = await editDraftParts({
    documentTitle: doc.document.title,
    forumName: doc.forumName,
    parts: editableParts,
    facts: factsForClaude(doc.spec, doc.content.fields).map((fact) => ({
      ...fact,
      several: doc.spec.fields.find((f) => f.id === fact.id)?.repeatable ?? false,
    })),
    instruction: mask(instruction),
    userId,
  });
  if (!result.ok) return { ok: false, message: FAILURES[result.reason] };
  await recordUsage({ kind: "draft", model: result.model, costUsd: result.costUsd, ...result.usage });

  const plan = planInstructionEdit(doc.spec, editableParts, result.reply);
  const context = await libraryOnlyContext(db, null);
  const content: DocumentContent = { ...doc.content, narrative: { ...doc.content.narrative }, edits: { ...doc.content.edits } };
  let changed = false;
  for (const [partId, text] of Object.entries(plan.parts)) {
    const checked = (await checkWithLibrary(text, context)).trim();
    if (!checked) continue;
    content.narrative[partId] = checked;
    delete content.edits[partId];
    changed = true;
  }
  const note = result.reply.note.trim().slice(0, 500) || (changed ? "Lawdeck changed the document." : "Lawdeck made no change.");
  if (!changed) return { ok: true, changed: false, note, askFor: plan.askFor };
  const saved = await saveVersion(db, id, content, "ai", result.model);
  return saved ? { ok: true, changed: true, note, askFor: plan.askFor } : { ok: false, message: NOT_SAVED };
}

// What Claude's reply may change: only the document's shown narrative parts (cleaned and within
// their limits, unchanged ones dropped), and questions only for the template's own facts.
export function planInstructionEdit(
  spec: TemplateSpec,
  editableParts: { id: string; maxWords: number; text: string }[],
  reply: DraftEditReply,
): { parts: Record<string, string>; askFor: AskFor[] } {
  const parts: Record<string, string> = {};
  for (const entry of reply.parts) {
    const part = editableParts.find((p) => p.id === entry.id);
    if (!part) continue;
    const cleaned = cleanPart(entry.text, spec, part.maxWords);
    if (cleaned && cleaned !== part.text.trim()) parts[part.id] = cleaned;
  }
  const askFor: AskFor[] = [];
  for (const ask of reply.askFor) {
    const field = spec.fields.find((f) => f.id === ask.field);
    if (!field || askFor.some((a) => a.field === field.id)) continue;
    askFor.push({ field: field.id, label: field.label, addAnother: ask.addAnother && field.repeatable });
  }
  return { parts, askFor };
}
