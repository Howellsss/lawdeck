"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed } from "./data";

// Campus chat moderation (migration 57; docs/specs/chat.md): anyone in chat reports a message once
// with a reason; admins hide or show it again, and open or close chat to verified students.
// Logs never contain message text or report notes.

type Fail = { ok: false; message: string };
const ADMINS_ONLY: Fail = { ok: false, message: "Only admins can do this." };

const reportSchema = z.object({
  id: z.uuid(),
  reason: z.enum(["abuse", "contact", "cheating", "spam", "other"], { error: "Choose a reason." }),
  note: z.string().trim().max(500, { error: "Keep the note under 500 characters." }).optional().default(""),
});

export async function reportMessage(input: z.input<typeof reportSchema>): Promise<{ ok: true } | Fail> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the report." };
  if (parsed.data.reason === "other" && parsed.data.note.length < 3) return { ok: false, message: "Say briefly what is wrong." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, message: "Please sign in again, then try once more." };
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return { ok: false, message: "Chat isn’t open to you yet." };
  const { error } = await db.from("chat_reports").insert({ message_id: parsed.data.id, reason: parsed.data.reason, note: parsed.data.note || null });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You have already reported this message. An admin will look at it." };
    console.error("chat report failed", { code: error.code });
    return { ok: false, message: "Your report wasn’t sent. Please try again." };
  }
  return { ok: true };
}

export async function hideMessage(input: { id: string; hide: boolean }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ id: z.uuid(), hide: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That message could not be found." };
  if ((await getStaffRole()) !== "admin") return ADMINS_ONLY;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("chat_set_hidden", { msg: parsed.data.id, hide: parsed.data.hide });
  if (error || data === "not_found") {
    if (error) console.error("chat hide failed", { code: error.code });
    return { ok: false, message: "That message could not be changed. Please try again." };
  }
  if (data === "not_allowed") return ADMINS_ONLY;
  return { ok: true };
}

// Admins on /admin/chat: refreshes the page after a change.
export async function hideFromQueue(input: { id: string; hide: boolean }): Promise<{ ok: true } | Fail> {
  const result = await hideMessage(input);
  if (result.ok) refresh();
  return result;
}

export async function closeReports(input: { id: string }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That message could not be found." };
  if ((await getStaffRole()) !== "admin") return ADMINS_ONLY;
  const db = await createSupabaseServerClient();
  const { error } = await db.from("chat_reports").update({ status: "closed" }).eq("message_id", parsed.data.id).eq("status", "open");
  if (error) {
    console.error("chat reports close failed", { code: error.code });
    return { ok: false, message: "That didn’t save. Please try again." };
  }
  refresh();
  return { ok: true };
}

export async function setChatOpen(input: { open: boolean }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ open: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the setting." };
  if ((await getStaffRole()) !== "admin") return ADMINS_ONLY;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("chat_settings").update({ open_to_students: parsed.data.open, updated_at: new Date().toISOString() }).eq("id", true).select("open_to_students");
  if (error || !data.length) {
    if (error) console.error("chat open switch failed", { code: error.code });
    return { ok: false, message: "The setting was not saved. Please try again." };
  }
  refresh();
  return { ok: true };
}

// Admin -> Chat: "Approve IDs automatically (testing)". It switches off a safety check, so admins only.
export async function setAutoApproveIds(input: { on: boolean }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ on: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the setting." };
  if ((await getStaffRole()) !== "admin") return ADMINS_ONLY;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("chat_settings").update({ auto_approve_ids: parsed.data.on, updated_at: new Date().toISOString() }).eq("id", true).select("auto_approve_ids");
  if (error || !data.length) {
    if (error) console.error("chat id test switch failed", { code: error.code });
    return { ok: false, message: "The setting was not saved. Please try again." };
  }
  refresh();
  return { ok: true };
}
