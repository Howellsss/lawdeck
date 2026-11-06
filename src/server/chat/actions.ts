"use server";

import { linkMentions, messageTags } from "@/lib/chatFormat";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { detectAudioKind, VOICE_MAX_BYTES, VOICE_MAX_SECONDS } from "@/lib/chatFiles";
import { LIBRARY_MAX_BYTES, detectFileKind } from "@/lib/libraryFiles";
import { sendErrorMessage } from "./sendErrors";
import { chatAllowed, MESSAGE_COLUMNS, PAGE, withAuthors, type ChatMessage, type ChatPerson } from "./data";

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

const fileSchema = z.object({
  path: z.string().max(200),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["pdf", "docx", "png", "jpeg", "voice"]),
  size: z.number().int().min(1).max(LIBRARY_MAX_BYTES),
  seconds: z.number().min(1).max(VOICE_MAX_SECONDS).optional(),
});
const sendSchema = z
  .object({
    groupId: z.uuid(),
    text: z.string().trim().max(4000, { error: "A message can be up to 4,000 characters." }),
    picked: z.array(z.object({ id: z.uuid(), name: z.string().min(1).max(80) })).max(20),
    files: z.array(fileSchema).max(4, { error: "Attach up to 4 files to a message." }).optional().default([]),
  })
  .refine((m) => m.text.length > 0 || m.files.length > 0, { error: "Type a message first." });

export async function sendMessage(input: z.input<typeof sendSchema>): Promise<{ ok: true; message: ChatMessage } | Fail> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your message." };
  const r = await ready();
  if (r.fail) return r.fail;
  const body = linkMentions(parsed.data.text, parsed.data.picked);
  if (body.length > 4000) return { ok: false, message: "A message can be up to 4,000 characters." };
  const checked = await checkFiles(r.db, parsed.data.groupId, r.account.id, parsed.data.files);
  if (!checked.ok) return checked;
  const { mentions, hashtags } = messageTags(body);
  const { data, error } = await r.db
    .from("chat_messages")
    .insert({ group_id: parsed.data.groupId, body, mentions, hashtags, attachments: parsed.data.files })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) {
    const known = sendErrorMessage(error);
    if (known) return { ok: false, message: known };
    console.error("chat send failed", { code: error.code });
    return { ok: false, message: "Your message wasn’t sent. Please try again." };
  }
  if (!data) return { ok: false, message: "Your message wasn’t sent. Please try again." };
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
  let query = r.db.from("chat_messages").select(MESSAGE_COLUMNS).eq("group_id", groupId).is("hidden_at", null);
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
  const { data, error } = await r.db.from("chat_messages").delete().eq("id", parsed.data.id).eq("owner_id", r.account.id).select("attachments");
  if (error || !data.length) return { ok: false, message: "That message could not be deleted." };
  const paths = (Array.isArray(data[0].attachments) ? data[0].attachments : []).flatMap((f) =>
    f && typeof f === "object" && !Array.isArray(f) && typeof f.path === "string" ? [f.path] : [],
  );
  if (paths.length) await r.db.storage.from("chat-files").remove(paths);
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

const EXT = { pdf: "pdf", docx: "docx", png: "png", jpeg: "jpg" } as const;
const VOICE_EXT = ["webm", "ogg", "m4a"] as const;

const startSchema = z.discriminatedUnion("kind", [
  z.object({
    groupId: z.uuid(),
    name: z.string().min(1).max(200),
    size: z.number().int().min(1).max(LIBRARY_MAX_BYTES, { error: "Files must be 25 MB or smaller." }),
    kind: z.enum(["pdf", "docx", "png", "jpeg"], { error: "Attach a PDF, Word (DOCX), PNG or JPEG file." }),
  }),
  z.object({
    groupId: z.uuid(),
    name: z.string().min(1).max(200),
    size: z.number().int().min(1).max(VOICE_MAX_BYTES, { error: "A voice note can be up to 5 MB." }),
    kind: z.literal("voice"),
    format: z.enum(VOICE_EXT),
  }),
]);

// A one-time link to put a file (or a voice note, in a study group) in the sender's own folder of a group.
export async function startChatFile(input: z.input<typeof startSchema>): Promise<{ ok: true; path: string; signedUrl: string } | Fail> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That file can’t be attached." };
  const r = await ready();
  if (r.fail) return r.fail;
  if (parsed.data.kind === "voice" && !(await isStudyGroup(r.db, parsed.data.groupId))) {
    return { ok: false, message: "Voice notes can be sent in study groups only." };
  }
  const ext = parsed.data.kind === "voice" ? parsed.data.format : EXT[parsed.data.kind];
  const path = `${parsed.data.groupId}/${r.account.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await r.db.storage.from("chat-files").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: "The file could not be attached. Please try again." };
  return { ok: true, path, signedUrl: data.signedUrl };
}

async function isStudyGroup(db: Db, groupId: string): Promise<boolean> {
  const { data } = await db.from("chat_groups").select("kind").eq("id", groupId).maybeSingle();
  return data?.kind === "study";
}

// Every attached file must be the sender's own, in this group, and really the kind it claims.
async function checkFiles(db: Db, groupId: string, me: string, files: z.infer<typeof fileSchema>[]): Promise<{ ok: true } | Fail> {
  for (const f of files) {
    const exts = f.kind === "voice" ? VOICE_EXT.join("|") : EXT[f.kind];
    const own = new RegExp(`^${groupId}/${me}/[0-9a-f-]{36}\\.(${exts})$`);
    if (!own.test(f.path)) return { ok: false, message: "That file could not be attached." };
    const download = await db.storage.from("chat-files").download(f.path);
    if (download.error || !download.data) return { ok: false, message: `“${f.name}” did not finish uploading. Please attach it again.` };
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const real = f.kind === "voice" ? detectAudioKind(bytes) === f.path.split(".").pop() && bytes.length <= VOICE_MAX_BYTES : detectFileKind(bytes) === f.kind;
    if (!real || bytes.length > LIBRARY_MAX_BYTES) {
      await db.storage.from("chat-files").remove([f.path]);
      return { ok: false, message: f.kind === "voice" ? "That voice note could not be read. Please record it again." : `“${f.name}” is not a real PDF, Word or image file.` };
    }
  }
  return { ok: true };
}
