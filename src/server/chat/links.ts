"use server";

import { z } from "@/lib/zod";
import { requestOrigin } from "@/server/auth/origin";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Study group invite links (migration 66; docs/specs/chat.md, step 4g). The creator makes a link
// (7 days; a new one stops the old one; they can turn it off). Opening it walks a person through
// sign-in, Lawdeck access, the chat ID step and the rules, then Join. The database checks each step.

type Fail = { ok: false; message: string };
const id = z.uuid();
const code = z.string().regex(/^[0-9a-f]{64}$/);

export async function createInviteLink(input: { groupId: string }): Promise<{ ok: true; url: string; expiresAt: string } | Fail> {
  const parsed = z.object({ groupId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That group could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Please sign in again, then try once more." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("chat_link_create", { g: parsed.data.groupId });
  if (error || !data) {
    if (error?.code === "42501") return { ok: false, message: "Only the person who created this group can make an invite link." };
    return { ok: false, message: "The link wasn’t made. Please try again." };
  }
  return { ok: true, url: `${await requestOrigin()}/chat/join/${data}`, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() };
}

export async function turnOffInviteLink(input: { groupId: string }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ groupId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That group could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Please sign in again, then try once more." };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("chat_link_revoke", { g: parsed.data.groupId });
  return error ? { ok: false, message: "The link wasn’t turned off. Please try again." } : { ok: true };
}

export type LinkStep = "invalid" | "full" | "access" | "verify" | "rules" | "other_side" | "member" | "ready";

// Where a person is on the way into the group (read when the join page opens).
export async function openInviteLink(raw: string): Promise<{ step: LinkStep; groupName: string | null; groupKey: string | null }> {
  const parsed = code.safeParse(raw);
  if (!parsed.success || !(await getCurrentAccount())) return { step: "invalid", groupName: null, groupKey: null };
  const db = await createSupabaseServerClient();
  const { data } = await db.rpc("chat_link_open", { code: parsed.data });
  const row = data?.[0];
  return { step: (row?.result as LinkStep | undefined) ?? "invalid", groupName: row?.group_name ?? null, groupKey: row?.group_key ?? null };
}

// The link lets a new person into Lawdeck while invite-only is on.
export async function claimLinkAccess(input: { code: string }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ code }).safeParse(input);
  if (!parsed.success || !(await getCurrentAccount())) return { ok: false, message: "That invite link doesn’t work." };
  const db = await createSupabaseServerClient();
  const { data } = await db.rpc("chat_link_claim_access", { code: parsed.data.code });
  return data ? { ok: true } : { ok: false, message: "That invite link has expired or was turned off." };
}

export async function joinByLink(input: { code: string }): Promise<{ ok: true; groupKey: string } | Fail> {
  const parsed = z.object({ code }).safeParse(input);
  if (!parsed.success || !(await getCurrentAccount())) return { ok: false, message: "That invite link doesn’t work." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("chat_link_join", { code: parsed.data.code });
  if (error || !data) {
    if (error?.message.includes("group_full")) return { ok: false, message: "This group is full (15 people)." };
    if (error?.message.includes("link_invalid")) return { ok: false, message: "That invite link has expired or was turned off. Ask for a new one." };
    return { ok: false, message: "You couldn’t join this group. Please refresh the page and try again." };
  }
  return { ok: true, groupKey: data };
}
