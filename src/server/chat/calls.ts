"use server";

import { z } from "@/lib/zod";
import { getStaffRole } from "@/server/auth/roles";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed } from "./data";
import { createRoom, deleteRoom, joinToken, liveKitConfig } from "./livekit";

// Group calls in study groups (migration 65; docs/specs/chat.md, step 4f). The server checks the
// student may join, then gives a short-lived pass for that call's room only. The browser checks in
// every 30 seconds; when the monthly limit is reached or the call runs 3 hours, the room is closed
// for everyone. No audio or video passes through Lawdeck and nothing is recorded.

type Fail = { ok: false; message: string };
const id = z.uuid();
const UNAVAILABLE: Fail = { ok: false, message: "Group calls aren’t switched on yet." };

async function ready() {
  const account = await getCurrentAccount();
  if (!account) return { fail: { ok: false, message: "Please sign in again, then try once more." } as Fail } as const;
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return { fail: { ok: false, message: "Chat isn’t open to you yet." } as Fail } as const;
  return { fail: null, db, account } as const;
}

export type CallPass = { ok: true; callId: string; url: string; token: string };

export async function joinCall(input: { groupId: string }): Promise<CallPass | Fail> {
  const parsed = z.object({ groupId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That group could not be found." };
  const config = liveKitConfig();
  if (!config) return UNAVAILABLE;
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_call_join", { g: parsed.data.groupId });
  const call = data?.[0];
  if (error || !call) {
    if (error?.message.includes("call_budget")) return { ok: false, message: "Group calls are full for this month. They’re back on the 1st." };
    if (error?.message.includes("call_full")) return { ok: false, message: "This call is full (15 people)." };
    if (error?.message.includes("post_limit")) return { ok: false, message: "You’re doing that very quickly. Please wait a minute, then try again." };
    if (error?.code === "42501") return { ok: false, message: "Calls are for members of this study group." };
    if (error) console.error("chat call join failed", { code: error.code });
    return { ok: false, message: "The call didn’t start. Please try again." };
  }
  if (call.started && !(await createRoom(config, call.room))) {
    await r.db.rpc("chat_call_leave", { c: call.call_id });
    console.error("chat call room failed");
    return { ok: false, message: "The call service didn’t answer. Please try again in a minute." };
  }
  const { data: me } = await r.db.rpc("chat_people", { people: [r.account.id] });
  return { ok: true, callId: call.call_id, url: config.url, token: joinToken(config, call.room, r.account.id, me?.[0]?.name ?? "Lawdeck student") };
}

export type Heartbeat = "ok" | "end" | "budget" | "too_long";

export async function callHeartbeat(input: { callId: string }): Promise<Heartbeat> {
  const parsed = z.object({ callId: id }).safeParse(input);
  if (!parsed.success) return "end";
  const r = await ready();
  if (r.fail) return "end";
  const { data, error } = await r.db.rpc("chat_call_heartbeat", { c: parsed.data.callId });
  if (error || !data) return "ok"; // A missed check-in is not a reason to drop a student.
  const result = data as Heartbeat;
  const config = liveKitConfig();
  if ((result === "budget" || result === "too_long") && config) await deleteRoom(config, `lawdeck-${parsed.data.callId}`);
  return result;
}

export async function leaveCall(input: { callId: string }): Promise<void> {
  const parsed = z.object({ callId: id }).safeParse(input);
  if (!parsed.success) return;
  const r = await ready();
  if (r.fail) return;
  await r.db.rpc("chat_call_leave", { c: parsed.data.callId });
}

export type CallStatus = { callId: string; startedAt: string; people: string[] } | null;

// Whether a study group has a call going, and who is in it.
export async function callStatus(input: { groupId: string }): Promise<CallStatus> {
  const parsed = z.object({ groupId: id }).safeParse(input);
  if (!parsed.success || !liveKitConfig()) return null;
  const r = await ready();
  if (r.fail) return null;
  const { data } = await r.db.rpc("chat_call_status", { g: parsed.data.groupId });
  const call = data?.[0];
  if (!call) return null;
  const ids = call.people.slice(0, 20);
  const { data: people } = ids.length ? await r.db.rpc("chat_people", { people: ids }) : { data: [] };
  return { callId: call.call_id, startedAt: call.started_at, people: (people ?? []).map((p) => p.name) };
}

// Admin -> Chat: change the monthly limit of call-minutes.
export async function setCallLimit(input: { minutes: number }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ minutes: z.number().int().min(0).max(10_000_000) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Type a whole number of minutes." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can change this." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("chat_settings").update({ call_minutes_month: parsed.data.minutes, updated_at: new Date().toISOString() }).eq("id", true).select("call_minutes_month");
  if (error || !data?.length) return { ok: false, message: "The limit was not saved. Please try again." };
  return { ok: true };
}
