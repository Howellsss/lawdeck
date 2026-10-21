import "server-only";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type LawChange = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  effectiveOn: string;
  note: string | null;
  source: string | null;
};

export type RecheckReason = { changeTitle: string; effectiveOn: string };

// All recorded changes, newest first (reviewers and admins; row-level security hides them from students).
export async function listLawChanges(): Promise<LawChange[]> {
  const supabase = await createSupabaseServerClient();
  const [changes, courses] = await Promise.all([
    supabase
      .from("law_changes")
      .select("id, course_id, title, effective_on, note, source")
      .order("effective_on", { ascending: false })
      .limit(500),
    supabase.from("courses").select("id, name"),
  ]);
  if (changes.error || courses.error) {
    console.error("law changes read failed", { code: changes.error?.code ?? courses.error?.code ?? "unknown" });
    throw new Error("Could not load the law changes.");
  }
  const names = new Map(courses.data.map((course) => [course.id, course.name]));
  return changes.data.map((change) => ({
    id: change.id,
    courseId: change.course_id,
    courseName: names.get(change.course_id) ?? "Unknown course",
    title: change.title,
    effectiveOn: change.effective_on,
    note: change.note,
    source: change.source,
  }));
}

// Which items need re-checking, and because of which changes (latest first).
export async function getRecheckReasons(itemIds?: string[]): Promise<Map<string, RecheckReason[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("kb_items_needing_recheck")
    .select("item_id, change_title, effective_on")
    .order("effective_on", { ascending: false })
    .limit(2000);
  if (itemIds) query = query.in("item_id", itemIds);
  const { data, error } = await query;
  if (error) {
    console.error("recheck read failed", { code: error.code });
    throw new Error("Could not check the library for out-of-date material.");
  }
  const reasons = new Map<string, RecheckReason[]>();
  for (const row of data) {
    const list = reasons.get(row.item_id) ?? [];
    list.push({ changeTitle: row.change_title, effectiveOn: row.effective_on });
    reasons.set(row.item_id, list);
  }
  return reasons;
}
