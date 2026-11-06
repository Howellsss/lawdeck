"use server";

import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed, getWeekTopic, MESSAGE_COLUMNS, withAuthors, type ChatMessage, type WeekTopic } from "./data";
import { sendErrorMessage } from "./sendErrors";

// Study together (migration 63; docs/specs/chat.md, step 4d): lesson cards in any group the student
// can see, and a study group's "This week's topic", set by its creator. A card points to a topic and
// never copies the lesson's text; only topics with an approved lesson can be shared. The database
// checks every rule again.

type Fail = { ok: false; message: string };
const id = z.uuid();

async function ready() {
  const account = await getCurrentAccount();
  if (!account) return { fail: { ok: false, message: "Please sign in again, then try once more." } as Fail } as const;
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return { fail: { ok: false, message: "Chat isn’t open to you yet." } as Fail } as const;
  return { fail: null, db, account } as const;
}

export type LessonTopic = { id: string; course: string; topic: string };

// Topics that can be shared, by course.
export async function lessonTopics(): Promise<{ ok: true; topics: LessonTopic[] } | Fail> {
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_lesson_topics");
  if (error) return { ok: false, message: "Topics could not be loaded. Please try again." };
  return { ok: true, topics: data.map((t) => ({ id: t.topic_id, course: t.course, topic: t.topic })) };
}

const shareSchema = z.object({
  groupId: id,
  topicId: id,
  note: z.string().trim().max(500, { error: "A note can be up to 500 characters." }).optional().default(""),
});

export async function shareLesson(input: z.input<typeof shareSchema>): Promise<{ ok: true; message: ChatMessage } | Fail> {
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Choose a topic to share." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { groupId, topicId, note } = parsed.data;
  const { data: messageId, error } = await r.db.rpc("chat_share_lesson", { g: groupId, topic: topicId, note });
  if (error || !messageId) {
    const known = error && sendErrorMessage(error);
    if (known) return { ok: false, message: known };
    if (error) console.error("chat share lesson failed", { code: error.code });
    return { ok: false, message: "The lesson wasn’t shared. Please try again." };
  }
  const { data } = await r.db.from("chat_messages").select(MESSAGE_COLUMNS).eq("id", messageId).maybeSingle();
  if (!data) return { ok: false, message: "The lesson was shared. Refresh the page to see it." };
  const [message] = await withAuthors(r.db, [data], r.account.id);
  return { ok: true, message };
}

const weekSchema = z.object({ groupId: id, topicId: id.nullable() });

// Sets (and posts the card) or clears a study group's "This week's topic". Its creator only.
export async function setWeekTopic(input: z.input<typeof weekSchema>): Promise<{ ok: true; weekTopic: WeekTopic | null } | Fail> {
  const parsed = weekSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a topic first." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { groupId, topicId } = parsed.data;
  const { error } = await r.db.rpc("chat_set_week_topic", { g: groupId, topic: topicId });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Only the person who created this study group can set this week’s topic." };
    const known = sendErrorMessage(error);
    if (known) return { ok: false, message: known };
    console.error("chat week topic failed", { code: error.code });
    return { ok: false, message: "This week’s topic wasn’t changed. Please try again." };
  }
  return { ok: true, weekTopic: topicId ? await getWeekTopic(r.db, groupId) : null };
}
