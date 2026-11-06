"use server";

import { linkMentions, messageTags } from "@/lib/chatFormat";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed, PAGE, withAuthors, type ChatMessage, type ChatPerson } from "./data";

// Campus chat actions (docs/specs/chat.md). Sign-in, chat access and input are checked here; the
// database checks them again (row-level security, the word filter and the posting limit). Logs
// never contain message text.

type Fail = { ok: false; message: string };
const NOT_OPEN: Fail = { ok: false, message: "Chat isn’t open to you yet." };
const SIGN_IN: Fail = { ok: false, message: "Please sign in again, then try once more." };

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Ready = { fail: Fail } | { fail: null; account: { id: string }; db: Db };

async function ready(): Promise<Ready> {
  const account = await getCurrentAccount();
  if (!account) return { fail: SIGN_IN };
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return { fail: NOT_OPEN };
  return { fail: null, account, db };
}

// Accepting the community rules makes a student a member, so they can post and be @mentioned.
export async function joinChat(): Promise<{ ok: true } | Fail> {
  const r = await ready();
  if (r.fail) return r.fail;
  const { error } = await r.db.from("chat_members").upsert({ owner_id: r.account.id }, { onConflict: "owner_id", ignoreDuplicates: true });
  if (error) {
    console.error("chat join failed", { code: error.code });
    return { ok: false, message: "That didn’t work. Please try again." };
  }
  return { ok: true };
}

const sendSchema = z.object({
  groupId: z.uuid(),
  text: z.string().trim().min(1, { error: "Type a message first." }).max(4000, { error: "A message can be up to 4,000 characters." }),
  picked: z.array(z.object({ id: z.uuid(), name: z.string().min(1).max(80) })).max(20),
});

export async function sendMessage(input: { groupId: string; text: string; picked: { id: string; name: string }[] }): Promise<{ ok: true; message: ChatMessage } | Fail> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your message." };
  const r = await ready();
  if (r.fail) return r.fail;
  const body = linkMentions(parsed.data.text, parsed.data.picked);
  if (body.length > 4000) return { ok: false, message: "A message can be up to 4,000 characters." };
  const { mentions, hashtags } = messageTags(body);
  const { data, error } = await r.db
    .from("chat_messages")
    .insert({ group_id: parsed.data.groupId, body, mentions, hashtags })
    .select("id, group_id, owner_id, body, created_at")
    .single();
  if (error) {
    if (error.message.includes("blocked_word")) {
      return { ok: false, message: "Your message wasn’t sent: it contains a word that isn’t allowed in Lawdeck chat. Please reword it." };
    }
    if (error.message.includes("contact_details")) {
      return { ok: false, message: "Your message wasn’t sent: phone numbers, email addresses and WhatsApp or social links aren’t allowed in Lawdeck chat, to keep everyone safe." };
    }
    if (error.message.includes("post_limit")) return { ok: false, message: "You’re sending messages very quickly. Please wait a minute, then try again." };
    if (error.code === "42501") return { ok: false, message: "Please accept the community rules before posting." };
    console.error("chat send failed", { code: error.code });
    return { ok: false, message: "Your message wasn’t sent. Please try again." };
  }
  const [message] = await withAuthors(r.db, [data], r.account.id);
  return { ok: true, message };
}

const pageSchema = z.object({ groupId: z.uuid(), after: z.iso.datetime({ offset: true }).optional(), before: z.iso.datetime({ offset: true }).optional() });

// Newer messages (checked every few seconds while a group is open) or an older page.
export async function loadMessages(input: { groupId: string; after?: string; before?: string }): Promise<{ ok: true; messages: ChatMessage[]; hasOlder: boolean } | Fail> {
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That group could not be found." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { groupId, after, before } = parsed.data;
  let query = r.db.from("chat_messages").select("id, group_id, owner_id, body, created_at").eq("group_id", groupId).is("hidden_at", null);
  if (after) query = query.gt("created_at", after).order("created_at", { ascending: true }).limit(100);
  else {
    if (before) query = query.lt("created_at", before);
    query = query.order("created_at", { ascending: false }).limit(PAGE + 1);
  }
  const { data, error } = await query;
  if (error) return { ok: false, message: "Messages could not be loaded. Please try again." };
  const rows = after ? data : data.slice(0, PAGE).reverse();
  return { ok: true, messages: await withAuthors(r.db, rows, r.account.id), hasOlder: !after && data.length > PAGE };
}

export async function deleteMessage(input: { id: string }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That message could not be found." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.from("chat_messages").delete().eq("id", parsed.data.id).eq("owner_id", r.account.id).select("id");
  if (error || !data.length) return { ok: false, message: "That message could not be deleted." };
  return { ok: true };
}

// The student has seen a group up to now (for unread counts).
export async function markRead(input: { groupId: string }): Promise<void> {
  const parsed = z.object({ groupId: z.uuid() }).safeParse(input);
  if (!parsed.success) return;
  const r = await ready();
  if (r.fail) return;
  await r.db.from("chat_reads").upsert({ group_id: parsed.data.groupId, last_read_at: new Date().toISOString() }, { onConflict: "owner_id,group_id" });
}

// Names for the @mention suggestions: chat members only, never an email address.
export async function findPeople(input: { q: string }): Promise<ChatPerson[]> {
  const parsed = z.object({ q: z.string().trim().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return [];
  const r = await ready();
  if (r.fail) return [];
  const { data } = await r.db.rpc("chat_people_search", { q: parsed.data.q });
  return data ?? [];
}
