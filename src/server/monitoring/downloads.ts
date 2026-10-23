import "server-only";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Records a Word download or export for the signed-in student (step 7e, rule P-03), so the hourly
// unusual-access check can spot bulk downloading. Never blocks the download: a failure is logged.
export async function recordDownload(kind: "document_docx" | "study_export"): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("record_download", { kind });
    if (error) console.error("download record failed", { kind, code: error.code ?? "unknown" });
  } catch (error) {
    console.error("download record failed", { kind, name: (error as Error)?.name ?? "unknown" });
  }
}
