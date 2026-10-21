"use server";

import { refresh } from "next/cache";
import { topicIdSchema, topicNameSchema, topicSlug } from "@/schemas/learn";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type TopicResult = { ok: true } | { ok: false; message: string };

const NOT_ALLOWED: TopicResult = { ok: false, message: "Only admins can change topics." };

function failed(action: string, code: string | undefined): TopicResult {
  console.error("topic action failed", { action, code: code ?? "unknown" });
  return { ok: false, message: "That did not work. Please try again." };
}

// Adds a topic at the end of a course's list. The address part comes from the name, with
// "-2", "-3"… added if another topic in the course already uses it.
export async function addTopic(courseId: string, name: string): Promise<TopicResult> {
  const id = topicIdSchema.safeParse(courseId);
  const parsed = topicNameSchema.safeParse(name);
  if (!id.success) return { ok: false, message: "That course could not be found." };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a topic name." };
  if ((await getStaffRole()) !== "admin") return NOT_ALLOWED;

  const supabase = await createSupabaseServerClient();
  const last = await supabase.from("topics").select("position").eq("course_id", id.data).order("position", { ascending: false }).limit(1);
  if (last.error) return failed("add.position", last.error.code);
  const position = (last.data[0]?.position ?? 0) + 1;
  const base = topicSlug(parsed.data);
  for (let attempt = 1; attempt <= 20; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { error } = await supabase.from("topics").insert({ course_id: id.data, slug, name: parsed.data, position });
    if (!error) {
      refresh();
      return { ok: true };
    }
    if (error.code !== "23505") return failed("add", error.code);
  }
  return { ok: false, message: "A topic with a very similar name already exists." };
}

export async function renameTopic(topicId: string, name: string): Promise<TopicResult> {
  const id = topicIdSchema.safeParse(topicId);
  const parsed = topicNameSchema.safeParse(name);
  if (!id.success) return { ok: false, message: "That topic could not be found." };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a topic name." };
  if ((await getStaffRole()) !== "admin") return NOT_ALLOWED;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("topics").update({ name: parsed.data }).eq("id", id.data).select("id");
  if (error) return failed("rename", error.code);
  if (data.length === 0) return { ok: false, message: "That topic no longer exists." };
  refresh();
  return { ok: true };
}

// Moves a topic one place up or down, then numbers the course's topics 1, 2, 3… in order.
export async function moveTopic(topicId: string, direction: "up" | "down"): Promise<TopicResult> {
  const id = topicIdSchema.safeParse(topicId);
  if (!id.success || (direction !== "up" && direction !== "down")) return { ok: false, message: "That topic could not be found." };
  if ((await getStaffRole()) !== "admin") return NOT_ALLOWED;
  const supabase = await createSupabaseServerClient();
  const topic = await supabase.from("topics").select("course_id").eq("id", id.data).maybeSingle();
  if (topic.error) return failed("move.load", topic.error.code);
  if (!topic.data) return { ok: false, message: "That topic no longer exists." };
  const all = await supabase.from("topics").select("id").eq("course_id", topic.data.course_id).order("position").order("name");
  if (all.error) return failed("move.list", all.error.code);
  const ids = all.data.map((row) => row.id);
  const from = ids.indexOf(id.data);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return { ok: true };
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const saved = await Promise.all(ids.map((topicRow, index) => supabase.from("topics").update({ position: index + 1 }).eq("id", topicRow)));
  const failure = saved.find((row) => row.error);
  if (failure?.error) return failed("move.save", failure.error.code);
  refresh();
  return { ok: true };
}

export async function removeTopic(topicId: string): Promise<TopicResult> {
  const id = topicIdSchema.safeParse(topicId);
  if (!id.success) return { ok: false, message: "That topic could not be found." };
  if ((await getStaffRole()) !== "admin") return NOT_ALLOWED;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("topics").delete().eq("id", id.data);
  if (error) return failed("remove", error.code);
  refresh();
  return { ok: true };
}
