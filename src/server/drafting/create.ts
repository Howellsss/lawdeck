import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitReachedMessage } from "@/lib/allowance";
import {
  documentContentSchema,
  factsFor,
  forumProfileSchema,
  templateSpecSchema,
  type DocumentContent,
  type NewDraft,
  type TemplateSpec,
} from "@/schemas/drafting";
import { writeDraftParts } from "@/server/ai/draft";
import { recordUsage } from "@/server/ai/usage";
import type { Database } from "@/server/db/types";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "@/server/learn/allowance";
import { checkWithLibrary } from "@/server/learn/answerFilter";
import { libraryOnlyContext } from "@/server/learn/filterContext";
import { cleanPart, factsForClaude } from "./standIns";

type Db = SupabaseClient<Database>;

export type CreateDraftResult = { ok: true; id: string } | { ok: false; message: string };

const NOT_FOUND = "That document isn’t available to draft. Choose one from the drafting catalogue.";

const FAILURES = {
  no_key: "Drafting is not switched on yet: the Claude key is missing on the server.",
  busy: "Lawdeck is busy right now. Please try again in a minute.",
  refused: "Lawdeck can’t draft this document from these facts. Check the facts and try again.",
  unavailable: "Lawdeck could not reach the drafting service. Please try again in a minute.",
  malformed: "Lawdeck could not write the draft this time. Please try again.",
} as const;

// Drafts a document for the signed-in student (PRD 7.1, DR-02 to DR-04). The approved template
// supplies the structure, order and fixed wording; Opus writes only the narrative parts, from
// the intake facts, with names and addresses as stand-ins (rule G-06). Missing facts stay as
// placeholders. A draft that used the AI counts as one question once saved; failures are free.
// Row-level security keeps the document to its owner and only allows approved templates.
export async function createDraft(db: Db, userId: string, input: NewDraft): Promise<CreateDraftResult> {
  const template = await db
    .from("templates")
    .select("id, title, course_id, spec, status")
    .eq("id", input.templateId)
    .maybeSingle();
  if (template.error) return failed("template", template.error.code);
  // Reviewers can read drafts too; only an approved template is ever used for a student's document.
  if (!template.data || template.data.status !== "approved") return { ok: false, message: NOT_FOUND };
  const spec = templateSpecSchema.safeParse(template.data.spec);
  if (!spec.success) {
    console.error("draft failed", { step: "spec" });
    return { ok: false, message: NOT_FOUND };
  }

  const forum = await chooseForum(db, input.templateId, input.forumId);
  if (!forum.ok) return forum;

  const facts = factsFor(spec.data, input.facts);
  if (!facts.ok) return facts;

  const content: DocumentContent = { fields: facts.fields, narrative: {}, edits: {} };
  const narrative = spec.data.parts.filter(
    (part) => part.kind === "narrative" && (!part.forums || (forum.slug !== null && part.forums.includes(forum.slug))),
  );
  let usage: { model: string; costUsd: number | null; tokensIn: number; tokensOut: number; ms: number } | null = null;

  if (narrative.length > 0) {
    // Rule K-01: the monthly limit is checked before anything costs money.
    const allowance = await getAllowance(db);
    if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
    if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };

    const written = await writeDraftParts({
      documentTitle: template.data.title,
      forumName: forum.name,
      outline: spec.data.parts.map((part) => ({ id: part.id, heading: part.heading ?? null, kind: part.kind })),
      parts: narrative.map((part) => ({
        id: part.id,
        heading: part.heading ?? null,
        instruction: part.instruction ?? "",
        maxWords: part.maxWords ?? 200,
      })),
      facts: factsForClaude(spec.data, facts.fields),
      userId,
    });
    if (!written.ok) return { ok: false, message: FAILURES[written.reason] };
    content.narrative = await checkedParts(db, spec.data, narrative, written.reply.parts, template.data.course_id);
    usage = { model: written.model, costUsd: written.costUsd, ...written.usage };
  }

  const saved = await saveDocument(db, {
    templateId: input.templateId,
    forumId: forum.id,
    title: template.data.title,
    content: documentContentSchema.parse(content),
    model: usage?.model ?? null,
  });
  if (!saved) return { ok: false, message: "The draft was not saved. Please try again." };
  // A saved draft written by the AI counts as one question this month (founder, 2026-10-23).
  if (usage) await recordUsage({ kind: "draft", ...usage });
  return { ok: true, id: saved };
}

// The court or registry: one the template is approved for. With a single choice it is used
// without asking; with several the student must choose (DR-03).
async function chooseForum(
  db: Db,
  templateId: string,
  forumId: string | null,
): Promise<{ ok: true; id: string | null; slug: string | null; name: string | null } | { ok: false; message: string }> {
  const links = await db.from("template_forums").select("forum_id").eq("template_id", templateId);
  if (links.error) return failed("forums", links.error.code);
  if (links.data.length === 0) return { ok: true, id: null, slug: null, name: null };
  const ids = links.data.map((link) => link.forum_id);
  const forums = await db.from("forums").select("id, slug, name, profile, status").in("id", ids).eq("status", "approved");
  if (forums.error) return failed("forums", forums.error.code);
  const usable = forums.data.filter((f) => forumProfileSchema.safeParse(f.profile).success);
  const chosen = forumId ? usable.find((f) => f.id === forumId) : usable.length === 1 ? usable[0] : undefined;
  if (!chosen) return { ok: false, message: forumId ? "That court or registry isn’t available for this document." : "Choose a court or registry." };
  return { ok: true, id: chosen.id, slug: chosen.slug, name: chosen.name };
}

// Claude's parts, cleaned and checked: only this template's narrative parts are kept; stand-ins
// that are not fields are dropped; word limits hold; any case or statute not in the approved
// library is removed (rules G-04, G-05). A part Claude left empty stays as a placeholder.
async function checkedParts(
  db: Db,
  spec: TemplateSpec,
  parts: TemplateSpec["parts"],
  reply: { id: string; text: string }[],
  courseId: string,
): Promise<Record<string, string>> {
  const context = await libraryOnlyContext(db, courseId);
  const out: Record<string, string> = {};
  for (const part of parts) {
    const raw = reply.find((entry) => entry.id === part.id)?.text ?? "";
    const cleaned = cleanPart(raw, spec, part.maxWords ?? 200);
    if (!cleaned) continue;
    const checked = (await checkWithLibrary(cleaned, context)).trim();
    if (checked) out[part.id] = checked;
  }
  return out;
}

// Saves the document and its first version. The database numbers the version and makes it
// current. If the version cannot be saved, the empty document is removed again.
async function saveDocument(
  db: Db,
  input: { templateId: string; forumId: string | null; title: string; content: DocumentContent; model: string | null },
): Promise<string | null> {
  const document = await db
    .from("documents")
    .insert({ template_id: input.templateId, forum_id: input.forumId, title: input.title.slice(0, 200) })
    .select("id")
    .single();
  if (document.error) {
    console.error("draft failed", { step: "document", code: document.error.code });
    return null;
  }
  const version = await db.from("document_versions").insert({
    document_id: document.data.id,
    content: input.content,
    created_by: input.model ? "ai" : "student",
    model: input.model,
  });
  if (version.error) {
    console.error("draft failed", { step: "version", code: version.error.code });
    await db.from("documents").delete().eq("id", document.data.id);
    return null;
  }
  return document.data.id;
}

function failed(step: string, code: string | undefined): { ok: false; message: string } {
  console.error("draft failed", { step, code: code ?? "unknown" });
  return { ok: false, message: "Lawdeck couldn’t load this document just now. Please try again." };
}
