"use server";

import { refresh } from "next/cache";
import { sourcePresentationSchema } from "@/schemas/library";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type PresentationResult = { ok: true; message: string } | { ok: false; message: string };

// Saves how an item is presented to students, and its rights (migration 37). Reviewers and admins;
// the database checks again (row-level security). Saved answer sources are relabelled by the
// database, and "restricted" withdraws the item from students.
export async function saveSourcePresentation(input: {
  id: string;
  kind: string;
  displayTitle: string;
  displayTopic: string;
  rightsStatus: string;
  rightsNote: string;
}): Promise<PresentationResult> {
  const parsed = sourcePresentationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers and admins can change this." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_items")
    .update({
      source_kind: parsed.data.kind,
      display_title: parsed.data.displayTitle,
      display_topic: parsed.data.displayTopic,
      rights_status: parsed.data.rightsStatus,
      rights_note: parsed.data.rightsNote,
    })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) {
    console.error("source presentation save failed", { code: error?.code ?? "no_row" });
    return { ok: false, message: "That wasn’t saved. Please try again." };
  }
  refresh();
  return {
    ok: true,
    message:
      parsed.data.rightsStatus === "restricted"
        ? "Saved. The item is withdrawn from students; answers that used it are listed below."
        : "Saved. Students see the new label, including in earlier answers.",
  };
}
