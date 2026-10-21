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
  reading: {
    status: "waiting" | "reading" | "done" | "failed";
    method: "text" | "scan" | "mixed" | null;
    quality: number | null;
    pageCount: number | null;
    pagesRead: number;
    passages: number;
    error: string | null;
  };
  search: { indexed: number; model: string | null; indexedAt: string | null };
};

// The library list for reviewers and admins. Callers check the role first;
// row-level security also limits what each person can see.
export async function listLibraryItems(): Promise<LibraryItemSummary[]> {
  const supabase = await createSupabaseServerClient();
  const [items, courses] = await Promise.all([
    supabase
      .from("kb_items")
      .select(
        "id, title, type, course_id, year, review_status, file_name, size_bytes, created_at, reading_status, reading_method, reading_quality, page_count, reading_error, indexed_passages, index_model, indexed_at, kb_passages(count), kb_item_pages(count)",
      )
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
    reading: {
      status: item.reading_status,
      method: item.reading_method,
      quality: item.reading_quality === null ? null : Number(item.reading_quality),
      pageCount: item.page_count,
      pagesRead: item.kb_item_pages[0]?.count ?? 0,
      passages: item.kb_passages[0]?.count ?? 0,
      error: item.reading_error,
    },
    search: { indexed: item.indexed_passages, model: item.index_model, indexedAt: item.indexed_at },
  }));
}
