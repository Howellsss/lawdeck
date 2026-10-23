"use server";

import { pagesLabel } from "@/lib/pages";
import { DRAFT_ROUTED, sourceIdSchema, startChatSchema } from "@/schemas/learn";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { routeRequest } from "@/server/ai/route";
import { limitReachedMessage } from "@/lib/allowance";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "./allowance";
import { titleFrom } from "./ask";
import { redactPersonalData } from "./redact";

export type StartChatResult =
  | { ok: true; id: string }
  | { ok: false; message: string; signIn?: boolean; routedToDraft?: boolean };

// Starts a Learn chat from the home composer or a course hub. In Auto mode the router decides
// first (Learn or Draft); if it cannot be reached, the request is treated as Learn. The question
// itself is then asked from the chat page, which streams the answer.
export async function startChat(input: { question: string; course: string; mode?: string }): Promise<StartChatResult> {
  const parsed = startChatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Type a question." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, signIn: true, message: "Sign in to ask Lawdeck a question." };

  // Rule K-01: no new chat, and no routing call, once this month's questions are used up.
  const supabase = await createSupabaseServerClient();
  const allowance = await getAllowance(supabase);
  if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
  if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };

  const auto = parsed.data.mode === "auto";
  if (auto && (await routeRequest(redactPersonalData(parsed.data.question), account.id)) === "draft") {
    return { ok: false, routedToDraft: true, message: DRAFT_ROUTED };
  }

  let courseId: string | null = null;
  if (parsed.data.course !== "all") {
    const course = await supabase.from("courses").select("id").eq("slug", parsed.data.course).maybeSingle();
    if (course.error || !course.data) return { ok: false, message: "That course could not be found." };
    courseId = course.data.id;
  }
  const { data, error } = await supabase
    .from("conversations")
    .insert({ title: titleFrom(parsed.data.question), mode: "learn", course_id: courseId, auto_routed: auto })
    .select("id")
    .single();
  if (error) {
    console.error("learn action failed", { action: "startChat", code: error.code });
    return { ok: false, message: "The chat could not be started. Please try again." };
  }
  return { ok: true, id: data.id };
}

export type OpenSourceResult =
  | {
      ok: true;
      source: { itemTitle: string; heading: string | null; text: string | null; pages: string | null; available: boolean };
    }
  | { ok: false; message: string };

// The wording of one source of the student's own answer, for the Sources panel (WS-04).
// The database only returns it to the answer's owner, and only while the material is
// approved and not out of date.
export async function openSource(id: string): Promise<OpenSourceResult> {
  const parsed = sourceIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "That source could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to see sources." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("source_passage", { source: parsed.data });
  if (error || !data?.[0]) {
    if (error) console.error("learn action failed", { action: "openSource", code: error.code });
    return { ok: false, message: "That source could not be opened. Please try again." };
  }
  const row = data[0];
  return {
    ok: true,
    source: {
      itemTitle: row.item_title,
      heading: row.heading,
      text: row.text,
      pages: pagesLabel(row.page_from, row.page_to),
      available: row.available,
    },
  };
}
