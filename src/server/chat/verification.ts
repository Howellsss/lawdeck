"use server";

import { refresh } from "next/cache";
import { detectFileKind } from "@/lib/libraryFiles";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Chat verification (migration 56; docs/specs/chat.md): a student sends their Law School ID card or
// admission letter (an aspirant, their university ID or final-year letter) and their number; an
// admin approves or rejects it. The document is deleted once decided. Never logs the number.

const BUCKET = "chat-ids";
const MAX_BYTES = 10 * 1024 * 1024;
type Fail = { ok: false; message: string };
const SIGN_IN: Fail = { ok: false, message: "Please sign in again, then try once more." };

const requestSchema = z
  .object({
    kind: z.enum(["student", "aspirant"], { error: "Choose Law School student or aspirant." }),
    campusKey: z.string().regex(/^[a-z][a-z-]{1,39}$/, { error: "Choose your campus." }),
    idNumber: z.string().trim().min(3, { error: "Type your number as it appears on your ID." }).max(40, { error: "That number is too long." }),
    fileName: z.string().min(1).max(200),
    size: z.number().int().min(1).max(MAX_BYTES, { error: "The file must be 10 MB or smaller." }),
  })
  .refine((r) => (r.kind === "aspirant") === (r.campusKey === "aspirant"), { error: "Choose your campus." });

const fileKind = (name: string) => {
  const ext = name.toLowerCase().split(".").at(-1);
  return ext === "pdf" ? "pdf" : ext === "png" ? "png" : ext === "jpg" || ext === "jpeg" ? "jpg" : null;
};

// Step 1: a one-time link to put the document in the student's own private folder.
export async function startVerification(input: z.input<typeof requestSchema>): Promise<{ ok: true; path: string; signedUrl: string } | Fail> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  const kind = fileKind(parsed.data.fileName);
  if (!kind) return { ok: false, message: "Upload a photo (PNG or JPEG) or a PDF of your ID or letter." };
  const account = await getCurrentAccount();
  if (!account) return SIGN_IN;
  const db = await createSupabaseServerClient();
  const path = `${account.id}/${crypto.randomUUID()}.${kind}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: "The upload could not start. Please try again." };
  return { ok: true, path, signedUrl: data.signedUrl };
}

// Step 2: check the file really is a photo or PDF, then record the request for an admin.
export async function submitVerification(input: z.input<typeof requestSchema> & { path: string }): Promise<{ ok: true } | Fail> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  const account = await getCurrentAccount();
  if (!account) return SIGN_IN;
  const kind = fileKind(parsed.data.fileName);
  const path = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png|jpg)$/).safeParse(input.path);
  if (!kind || !path.success || !path.data.startsWith(`${account.id}/`)) return { ok: false, message: "The upload details were not valid. Please start again." };
  const db = await createSupabaseServerClient();
  const file = await db.storage.from(BUCKET).download(path.data);
  if (file.error || !file.data) return { ok: false, message: "The file did not arrive. Please upload it again." };
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  const real = detectFileKind(bytes);
  const realKind = real === "jpeg" ? "jpg" : real === "png" || real === "pdf" ? real : null;
  if (realKind !== kind || bytes.length > MAX_BYTES) {
    await db.storage.from(BUCKET).remove([path.data]);
    return { ok: false, message: "That file is not a real photo or PDF. Upload a PNG, JPEG or PDF of your ID or letter." };
  }
  const { error } = await db.from("chat_verifications").insert({
    kind: parsed.data.kind,
    campus_key: parsed.data.campusKey,
    id_number: parsed.data.idNumber,
    document_path: path.data,
  });
  if (error) {
    await db.storage.from(BUCKET).remove([path.data]);
    if (error.code === "23505") return { ok: false, message: "You already have a request being checked." };
    if (error.code === "42501") return { ok: false, message: "You can’t ask to join chat again." };
    console.error("verification request failed", { code: error.code });
    return { ok: false, message: "Your request wasn’t sent. Please try again." };
  }
  refresh();
  return { ok: true };
}

const quickSchema = z
  .object({
    kind: z.enum(["student", "aspirant"], { error: "Choose Law School student or aspirant." }),
    campusKey: z.string().regex(/^[a-z][a-z-]{1,39}$/, { error: "Choose your campus." }),
    idNumber: z.string().trim().min(3, { error: "Type at least 3 characters." }).max(40, { error: "That number is too long." }),
  })
  .refine((r) => (r.kind === "aspirant") === (r.campusKey === "aspirant"), { error: "Choose your campus." });

// Whether "Approve IDs automatically (testing)" is on (Admin -> Chat).
export async function idTestMode(): Promise<boolean> {
  if (!(await getCurrentAccount())) return false;
  const db = await createSupabaseServerClient();
  const { data } = await db.from("chat_settings").select("auto_approve_ids").eq("id", true).maybeSingle();
  return data?.auto_approve_ids === true;
}

// While the test switch is on: the number only, no document; the database approves it at once.
export async function submitQuickVerification(input: z.input<typeof quickSchema>): Promise<{ ok: true } | Fail> {
  const parsed = quickSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  if (!(await idTestMode())) return { ok: false, message: "Please add a photo or PDF of your ID." };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("chat_verifications").insert({ kind: parsed.data.kind, campus_key: parsed.data.campusKey, id_number: parsed.data.idNumber });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You already have a request being checked." };
    if (error.code === "42501") return { ok: false, message: "You can’t ask to join chat again." };
    console.error("verification request failed", { code: error.code });
    return { ok: false, message: "Your request wasn’t sent. Please try again." };
  }
  refresh();
  return { ok: true };
}

export type MyVerification = { status: "pending" | "approved" | "rejected" | "revoked"; kind: "student" | "aspirant"; campusKey: string; note: string | null } | null;

export async function getMyVerification(): Promise<MyVerification> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("chat_verifications")
    .select("status, kind, campus_key, note")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { status: data.status, kind: data.kind, campusKey: data.campus_key, note: data.note } : null;
}

// Admins: a short-lived link to look at the document.
export async function viewVerificationDocument(input: { id: string }): Promise<{ ok: true; url: string } | Fail> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success || (await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can open ID documents." };
  const db = await createSupabaseServerClient();
  const row = await db.from("chat_verifications").select("document_path").eq("id", parsed.data.id).maybeSingle();
  if (!row.data?.document_path) return { ok: false, message: "The document has already been deleted." };
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(row.data.document_path, 120);
  if (error || !data) return { ok: false, message: "The document could not be opened." };
  return { ok: true, url: data.signedUrl };
}

const decideSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected", "revoked"]),
  note: z.string().trim().max(500).optional().default(""),
});

// Admins: approve, reject (with a reason the student sees) or remove from chat. The document is
// deleted as soon as a decision is made.
export async function decideVerification(input: { id: string; decision: string; note?: string }): Promise<{ ok: true } | Fail> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the decision." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can decide." };
  if (parsed.data.decision === "rejected" && parsed.data.note.length < 3) return { ok: false, message: "Say briefly why, so the student can fix it." };
  const db = await createSupabaseServerClient();
  const row = await db.from("chat_verifications").select("document_path").eq("id", parsed.data.id).maybeSingle();
  if (row.error || !row.data) return { ok: false, message: "That request could not be found." };
  if (row.data.document_path) await db.storage.from(BUCKET).remove([row.data.document_path]);
  const { error } = await db
    .from("chat_verifications")
    .update({ status: parsed.data.decision, note: parsed.data.note || null, document_path: null })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("verification decision failed", { code: error.code });
    return { ok: false, message: "The decision was not saved. Please try again." };
  }
  refresh();
  return { ok: true };
}

// Admins: how many verification requests are waiting (for the Admin menu). 0 for everyone else.
export async function pendingChatChecks(): Promise<number> {
  if ((await getStaffRole()) !== "admin") return 0;
  const db = await createSupabaseServerClient();
  const { count } = await db.from("chat_verifications").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}
