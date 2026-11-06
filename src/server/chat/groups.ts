"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed, type ChatPerson } from "./data";

// Study groups (migration 59; docs/specs/chat.md). Sign-in, chat access and input are checked here;
// the database checks every rule again (who may invite, the 15-person and 10-group limits, the word
// filter on names). Logs never contain names.

type Fail = { ok: false; message: string };
type Done = { ok: true } | Fail;
const SIGN_IN: Fail = { ok: false, message: "Please sign in again, then try once more." };
const NOT_OPEN: Fail = { ok: false, message: "Chat isn’t open to you yet." };
const BAD_NAME = "Choose a name of 2 to 60 characters, without blocked words or contact details.";
const nameSchema = z.string().trim().min(2, { error: BAD_NAME }).max(60, { error: BAD_NAME });
const id = z.uuid();

async function ready() {
  const account = await getCurrentAccount();
  if (!account) return { fail: SIGN_IN } as const;
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return { fail: NOT_OPEN } as const;
  return { fail: null, db } as const;
}

function failed(code: string | undefined): Fail {
  if (code) console.error("study group action failed", { code });
  return { ok: false, message: "That didn’t work. Please try again." };
}

export async function createStudyGroup(input: { name: string }): Promise<{ ok: true; key: string } | Fail> {
  const name = nameSchema.safeParse(input.name);
  if (!name.success) return { ok: false, message: BAD_NAME };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_create_study_group", { group_name: name.data });
  if (error) return failed(error.code);
  if (data === "bad_name") return { ok: false, message: BAD_NAME };
  if (data === "too_many") return { ok: false, message: "You can create up to 10 study groups. Delete one you no longer use first." };
  if (data === "not_allowed") return { ok: false, message: "Accept the community rules in a campus group first, then create a study group." };
  return { ok: true, key: data };
}

export async function findInvitees(input: { groupId: string; q: string }): Promise<ChatPerson[]> {
  const parsed = z.object({ groupId: id, q: z.string().trim().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return [];
  const r = await ready();
  if (r.fail) return [];
  const { data } = await r.db.rpc("chat_invite_search", { g: parsed.data.groupId, q: parsed.data.q });
  return data ?? [];
}

export async function inviteToGroup(input: { groupId: string; personId: string }): Promise<Done> {
  const parsed = z.object({ groupId: id, personId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That person could not be invited." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_invite", { g: parsed.data.groupId, person: parsed.data.personId });
  if (error) return failed(error.code);
  if (data === "full") return { ok: false, message: "A study group can have up to 15 people, counting invitations." };
  if (data === "already") return { ok: false, message: "They are already in this group or invited." };
  if (data === "not_allowed") return { ok: false, message: "That person can’t be invited to this group." };
  refresh();
  return { ok: true };
}

export async function answerInvite(input: { groupId: string; accept: boolean }): Promise<Done> {
  const parsed = z.object({ groupId: id, accept: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That invitation could not be found." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_answer_invite", { g: parsed.data.groupId, accept: parsed.data.accept });
  if (error) return failed(error.code);
  if (data !== "ok") return { ok: false, message: "That invitation is no longer open." };
  refresh();
  return { ok: true };
}

export async function leaveGroup(input: { groupId: string }): Promise<Done> {
  const parsed = id.safeParse(input.groupId);
  if (!parsed.success) return { ok: false, message: "That group could not be found." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_leave_group", { g: parsed.data });
  if (error) return failed(error.code);
  if (data === "owner") return { ok: false, message: "You created this group, so you can delete it instead of leaving." };
  if (data !== "ok") return { ok: false, message: "That group could not be found." };
  return { ok: true };
}

export async function removeMember(input: { groupId: string; personId: string }): Promise<Done> {
  const parsed = z.object({ groupId: id, personId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That person could not be removed." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_remove_member", { g: parsed.data.groupId, person: parsed.data.personId });
  if (error) return failed(error.code);
  if (data !== "ok") return { ok: false, message: "Only the person who created the group can remove people." };
  refresh();
  return { ok: true };
}

export async function renameGroup(input: { groupId: string; name: string }): Promise<Done> {
  const groupId = id.safeParse(input.groupId);
  const name = nameSchema.safeParse(input.name);
  if (!groupId.success) return { ok: false, message: "That group could not be found." };
  if (!name.success) return { ok: false, message: BAD_NAME };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_rename_group", { g: groupId.data, group_name: name.data });
  if (error) return failed(error.code);
  if (data === "bad_name") return { ok: false, message: BAD_NAME };
  if (data !== "ok") return { ok: false, message: "Only the person who created the group can rename it." };
  refresh();
  return { ok: true };
}

export async function deleteGroup(input: { groupId: string }): Promise<Done> {
  const parsed = id.safeParse(input.groupId);
  if (!parsed.success) return { ok: false, message: "That group could not be found." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_delete_group", { g: parsed.data });
  if (error) return failed(error.code);
  if (data !== "ok") return { ok: false, message: "Only the person who created the group can delete it." };
  return { ok: true };
}
