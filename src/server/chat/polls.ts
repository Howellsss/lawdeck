"use server";

import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed, MESSAGE_COLUMNS, pollCards, withAuthors, type ChatMessage, type ChatPoll } from "./data";
import { sendErrorMessage } from "./sendErrors";

// Polls in chat (migration 64; docs/specs/chat.md, step 4e). Any group the student can see; one vote
// each, changeable until the poll closes; results after voting or once closed; anonymous unless the
// maker shows names (study groups only). The database checks every rule again.

type Fail = { ok: false; message: string };
const id = z.uuid();

async function ready() {
  const account = await getCurrentAccount();
  if (!account) return { fail: { ok: false, message: "Please sign in again, then try once more." } as Fail } as const;
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return { fail: { ok: false, message: "Chat isn’t open to you yet." } as Fail } as const;
  return { fail: null, db, account } as const;
}

const createSchema = z.object({
  groupId: id,
  question: z.string().trim().min(1, { error: "Type a question." }).max(200, { error: "A question can be up to 200 characters." }),
  choices: z
    .array(z.string().trim().max(80, { error: "A choice can be up to 80 characters." }))
    .transform((list) => list.filter(Boolean))
    .refine((list) => list.length >= 2 && list.length <= 6, { error: "Give 2 to 6 choices." })
    .refine((list) => new Set(list.map((c) => c.toLowerCase())).size === list.length, { error: "Each choice must be different." }),
  days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  showNames: z.boolean().optional().default(false),
});

export async function createPoll(input: z.input<typeof createSchema>): Promise<{ ok: true; message: ChatMessage } | Fail> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your poll." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { groupId, question, choices, days, showNames } = parsed.data;
  const { data: messageId, error } = await r.db.rpc("chat_poll_create", { g: groupId, question, options: choices, days, names: showNames });
  if (error || !messageId) {
    const known = error && sendErrorMessage(error);
    if (known) return { ok: false, message: known };
    if (error) console.error("chat poll create failed", { code: error.code });
    return { ok: false, message: "Your poll wasn’t posted. Please try again." };
  }
  const { data } = await r.db.from("chat_messages").select(MESSAGE_COLUMNS).eq("id", messageId).maybeSingle();
  if (!data) return { ok: false, message: "Your poll was posted. Refresh the page to see it." };
  const [message] = await withAuthors(r.db, [data], r.account.id);
  return { ok: true, message };
}

const voteSchema = z.object({ messageId: id, pollId: id, choice: z.number().int().min(0).max(5) });

export async function votePoll(input: z.input<typeof voteSchema>): Promise<{ ok: true; poll: ChatPoll | null } | Fail> {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick one of the choices." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_poll_vote", { p: parsed.data.pollId, pick: parsed.data.choice });
  if (error) return { ok: false, message: "Your vote wasn’t counted. Please try again." };
  if (data === "not_allowed") return { ok: false, message: "You can’t vote in this poll." };
  const poll = (await pollCards(r.db, [parsed.data.messageId])).get(parsed.data.messageId) ?? null;
  if (data === "closed") return { ok: false, message: "This poll has closed." };
  return { ok: true, poll };
}

const closeSchema = z.object({ messageId: id, pollId: id });

export async function closePoll(input: z.input<typeof closeSchema>): Promise<{ ok: true; poll: ChatPoll | null } | Fail> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That poll could not be found." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_poll_close", { p: parsed.data.pollId });
  if (error || data !== "ok") return { ok: false, message: "Only the person who made a poll can close it." };
  return { ok: true, poll: (await pollCards(r.db, [parsed.data.messageId])).get(parsed.data.messageId) ?? null };
}

// Fresh counts for the open polls on screen (checked every few seconds while the group is open).
export async function refreshPolls(input: { messageIds: string[] }): Promise<Record<string, ChatPoll>> {
  const parsed = z.object({ messageIds: z.array(id).max(100) }).safeParse(input);
  if (!parsed.success || parsed.data.messageIds.length === 0) return {};
  const r = await ready();
  if (r.fail) return {};
  return Object.fromEntries(await pollCards(r.db, parsed.data.messageIds));
}
