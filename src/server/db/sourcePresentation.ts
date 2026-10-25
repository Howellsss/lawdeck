import "server-only";
import type { SourceKindKey, SourceRightsKey } from "@/lib/libraryLabels";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// How library items are presented to students, their rights, and where they were used
// (migration 37). Staff only. Each read returns null if migration 37 is not in the database yet,
// so the library pages keep working. Logs error codes only (rule I-03).

export type SourcePresentation = {
  kind: SourceKindKey;
  displayTitle: string | null;
  displayTopic: string | null;
  rightsStatus: SourceRightsKey;
  rightsNote: string | null;
  // The original Drive link or source note: for staff only, never shown to students.
  driveSource: string | null;
};

export async function getSourcePresentation(id: string): Promise<SourcePresentation | null> {
  if (!(await getStaffRole())) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_items")
    .select("source_kind, display_title, display_topic, rights_status, rights_note, source")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("source presentation read failed", { code: error.code });
    return null;
  }
  return {
    kind: data.source_kind,
    displayTitle: data.display_title,
    displayTopic: data.display_topic,
    rightsStatus: data.rights_status,
    rightsNote: data.rights_note,
    driveSource: data.source,
  };
}

// For the library list: each item's kind and rights, to flag what needs attention.
export async function getSourceFlags(): Promise<Map<string, { kind: SourceKindKey; rights: SourceRightsKey }>> {
  if (!(await getStaffRole())) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("kb_items").select("id, source_kind, rights_status").limit(500);
  if (error) {
    console.error("source flags read failed", { code: error.code });
    return new Map();
  }
  return new Map(data.map((row) => [row.id, { kind: row.source_kind, rights: row.rights_status }]));
}

export type ItemUsage = { answers: number; students: number; lastUsed: string | null; answerIds: { id: string; usedAt: string }[] };

// The answers that relied on an item (admins only), for a withdrawn or challenged source.
export async function getItemUsage(id: string): Promise<ItemUsage | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const [usage, answers] = await Promise.all([
    supabase.rpc("admin_item_usage", { item: id }),
    supabase.rpc("admin_item_answers", { item: id }),
  ]);
  if (usage.error || answers.error) {
    console.error("item usage read failed", { code: usage.error?.code ?? answers.error?.code });
    return null;
  }
  const row = usage.data[0];
  return {
    answers: row?.answers ?? 0,
    students: row?.students ?? 0,
    lastUsed: row?.last_used ?? null,
    answerIds: answers.data.map((a) => ({ id: a.message_id, usedAt: a.used_at })),
  };
}

export type TracedSource = {
  label: number;
  studentLabel: string;
  itemId: string | null;
  originalTitle: string | null;
  fileName: string | null;
  driveSource: string | null;
  kind: SourceKindKey | null;
  rightsStatus: SourceRightsKey | null;
  reviewStatus: string | null;
  heading: string | null;
  pageFrom: number | null;
  pageTo: number | null;
  passageText: string | null;
};

// Every library source and passage behind one answer (admins only).
export async function getAnswerSources(answerId: string): Promise<TracedSource[] | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_answer_sources", { answer: answerId });
  if (error) {
    console.error("answer sources read failed", { code: error.code });
    throw new Error("The sources could not be loaded.");
  }
  return data.map((row) => ({
    label: row.label,
    studentLabel: row.student_label,
    itemId: row.item_id,
    originalTitle: row.original_title,
    fileName: row.file_name,
    driveSource: row.drive_source,
    kind: row.source_kind,
    rightsStatus: row.rights_status,
    reviewStatus: row.review_status,
    heading: row.passage_heading,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    passageText: row.passage_text,
  }));
}
