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
  review: { note: string | null; lawCurrentAsOf: string | null; reviewedAt: string | null };
};

const ITEM_COLUMNS =
  "id, title, type, course_id, year, review_status, file_name, size_bytes, created_at, reading_status, reading_method, reading_quality, page_count, reading_error, indexed_passages, index_model, indexed_at, review_note, law_current_as_of, reviewed_at, kb_passages(count), kb_item_pages(count)";

// The library list for reviewers and admins, optionally one review status only. Callers check
// the role first; row-level security also limits what each person can see.
export async function listLibraryItems(status?: LibraryItemSummary["reviewStatus"]): Promise<LibraryItemSummary[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("kb_items").select(ITEM_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (status) query = query.eq("review_status", status);
  const [items, courses] = await Promise.all([query, supabase.from("courses").select("id, name")]);
  if (items.error || courses.error) {
    console.error("library read failed", { code: items.error?.code ?? courses.error?.code ?? "unknown" });
    throw new Error("Could not load the library.");
  }
  const courseNames = new Map(courses.data.map((course) => [course.id, course.name]));
  return items.data.map((item) => toSummary(item, courseNames));
}

// One item, or null when it does not exist (or the person may not see it).
export async function getLibraryItem(id: string): Promise<LibraryItemSummary | null> {
  const supabase = await createSupabaseServerClient();
  const [item, courses] = await Promise.all([
    supabase.from("kb_items").select(ITEM_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("courses").select("id, name"),
  ]);
  if (item.error || courses.error) {
    console.error("library read failed", { code: item.error?.code ?? courses.error?.code ?? "unknown" });
    throw new Error("Could not load the library item.");
  }
  if (!item.data) return null;
  return toSummary(item.data, new Map(courses.data.map((course) => [course.id, course.name])));
}

export type ReviewPassage = {
  id: string;
  position: number;
  heading: string | null;
  text: string;
  pageFrom: number | null;
  pageTo: number | null;
  indexed: boolean;
};

export const PASSAGES_PER_PAGE = 20;

// One page of an item's passages, in order, for reviewers (row-level security: reviewers only).
export async function getReviewPassages(
  itemId: string,
  page: number,
  currentModel: string,
): Promise<{ passages: ReviewPassage[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * PASSAGES_PER_PAGE;
  const { data, error, count } = await supabase
    .from("kb_passages")
    .select("id, position, heading, text, page_from, page_to, embedding_model", { count: "exact" })
    .eq("item_id", itemId)
    .order("position")
    .range(from, from + PASSAGES_PER_PAGE - 1);
  if (error) {
    console.error("library read failed", { code: error.code });
    throw new Error("Could not load the passages.");
  }
  return {
    total: count ?? 0,
    passages: data.map((p) => ({
      id: p.id,
      position: p.position,
      heading: p.heading,
      text: p.text,
      pageFrom: p.page_from,
      pageTo: p.page_to,
      indexed: p.embedding_model === currentModel,
    })),
  };
}

type ItemRow = {
  id: string;
  title: string;
  type: KbItemTypeKey;
  course_id: string;
  year: number | null;
  review_status: LibraryItemSummary["reviewStatus"];
  file_name: string | null;
  size_bytes: number | null;
  created_at: string;
  reading_status: LibraryItemSummary["reading"]["status"];
  reading_method: LibraryItemSummary["reading"]["method"];
  reading_quality: number | string | null;
  page_count: number | null;
  reading_error: string | null;
  indexed_passages: number;
  index_model: string | null;
  indexed_at: string | null;
  review_note: string | null;
  law_current_as_of: string | null;
  reviewed_at: string | null;
  kb_passages: { count: number }[];
  kb_item_pages: { count: number }[];
};

function toSummary(item: ItemRow, courseNames: Map<string, string>): LibraryItemSummary {
  return {
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
    review: { note: item.review_note, lawCurrentAsOf: item.law_current_as_of, reviewedAt: item.reviewed_at },
  };
}
