import "server-only";
import type { KbItemTypeKey } from "@/lib/libraryLabels";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type LibraryItemSummary = {
  id: string;
  title: string;
  type: KbItemTypeKey;
  courseName: string;
  year: number | null;
  reviewStatus: "pending" | "approved" | "rejected" | "withdrawn";
  fileName: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

// The library list for reviewers and admins. Callers check the role first;
// row-level security also limits what each person can see.
export async function listLibraryItems(): Promise<LibraryItemSummary[]> {
  const supabase = await createSupabaseServerClient();
  const [items, courses] = await Promise.all([
    supabase
      .from("kb_items")
      .select("id, title, type, course_id, year, review_status, file_name, size_bytes, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("courses").select("id, name"),
  ]);
  if (items.error || courses.error) {
    console.error("library read failed", { code: items.error?.code ?? courses.error?.code ?? "unknown" });
    throw new Error("Could not load the library.");
  }
  const courseNames = new Map(courses.data.map((course) => [course.id, course.name]));
  return items.data.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    courseName: courseNames.get(item.course_id) ?? "Unknown course",
    year: item.year,
    reviewStatus: item.review_status,
    fileName: item.file_name,
    sizeBytes: item.size_bytes,
    createdAt: item.created_at,
  }));
}
