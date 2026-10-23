import "server-only";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { WorkspaceLoadError } from "./workspace";

// Reads for the My uploads page (step 6a). Row-level security limits every row to its owner.

export type UploadRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "processing" | "ready" | "failed";
  ocrConfidence: number | null;
  problem: string | null;
  createdAt: string;
};
export type UploadsPage = {
  noticeAccepted: boolean;
  files: UploadRow[];
  fileLimit: number | null;
  scanPagesLeft: number | null;
};

function failed(what: string, code: string | undefined): never {
  console.error("uploads read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

export async function getUploadsPage(): Promise<UploadsPage | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const supabase = await createSupabaseServerClient();
  const [profile, files, plans, scanLeft] = await Promise.all([
    supabase
      .from("profiles")
      .select("upload_notice_accepted_at, plan_id")
      .eq("id", account.id)
      .maybeSingle(),
    supabase
      .from("uploads")
      .select(
        "id, file_name, mime_type, size_bytes, status, ocr_confidence, problem, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("plans").select("id, name, upload_limit"),
    supabase.rpc("scan_pages_left"),
  ]);
  if (profile.error) failed("profile", profile.error.code);
  if (files.error) failed("uploads", files.error.code);
  if (plans.error) failed("plans", plans.error.code);
  const plan =
    plans.data.find((p) => p.id === profile.data?.plan_id) ??
    plans.data.find((p) => p.name === "Free");
  return {
    noticeAccepted: !!profile.data?.upload_notice_accepted_at,
    fileLimit: plan?.upload_limit ?? null,
    // Unknown if the check fails: the page simply does not show the figure.
    scanPagesLeft: scanLeft.error ? null : scanLeft.data,
    files: files.data.map((f) => ({
      id: f.id,
      fileName: f.file_name,
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      status: f.status,
      ocrConfidence:
        f.ocr_confidence === null ? null : Number(f.ocr_confidence),
      problem: f.problem,
      createdAt: f.created_at,
    })),
  };
}
