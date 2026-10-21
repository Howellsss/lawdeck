"use server";

import { refresh } from "next/cache";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { detectFileKind, LIBRARY_FILE_TYPES, LIBRARY_MAX_BYTES, type LibraryFileKind } from "@/lib/libraryFiles";
import { libraryDetailsSchema, libraryFileSchema, libraryItemIdSchema, libraryPathSchema } from "@/schemas/library";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

const BUCKET = "library";
// Files uploaded but never finished are removed after this long.
const LEFTOVER_AFTER_MS = 60 * 60 * 1000;

export type UploadDetails = {
  title: string;
  type: string;
  courseId: string;
  campus: string;
  year: string;
  source: string;
  fileName: string;
  size: number;
  kind: string;
};

export type StartUploadResult =
  | { ok: true; path: string; signedUrl: string }
  | { ok: false; message?: string; fieldErrors?: FieldErrors };

export type FinishUploadResult = { ok: true } | { ok: false; message: string };

const NOT_ALLOWED = "Only admins can add to the library.";

// Logs the action and error code only, never file contents (rule I-03).
function logFailure(action: string, code: string | undefined) {
  console.error("library action failed", { action, code: code ?? "unknown" });
}

function parseDetails(input: UploadDetails) {
  const details = libraryDetailsSchema.safeParse(input);
  const file = libraryFileSchema.safeParse({ fileName: input.fileName, size: input.size, kind: input.kind });
  if (!details.success || !file.success) {
    return {
      ok: false as const,
      fieldErrors: {
        ...(details.success ? {} : fieldErrorsFrom(details.error)),
        ...(file.success ? {} : { file: file.error.issues[0]?.message }),
      },
    };
  }
  return { ok: true as const, details: details.data, file: file.data };
}

// Step 1: check the details and give the browser a one-time link to upload the file
// straight into the private library store (Vercel cannot carry 25 MB files itself).
export async function startLibraryUpload(input: UploadDetails): Promise<StartUploadResult> {
  const parsed = parseDetails(input);
  if (!parsed.ok) return parsed;
  if ((await getStaffRole()) !== "admin") return { ok: false, message: NOT_ALLOWED };

  const supabase = await createSupabaseServerClient();
  await removeLeftovers(parsed.details.courseId);
  const path = `${parsed.details.courseId}/${crypto.randomUUID()}.${parsed.file.kind}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    logFailure("startLibraryUpload", error?.name);
    return { ok: false, message: "The upload could not start. Please try again." };
  }
  return { ok: true, path, signedUrl: data.signedUrl };
}

// Step 2: after the browser has uploaded, check the file is really what it claims to be,
// then record the library item ("awaiting review").
export async function finishLibraryUpload(input: UploadDetails & { path: string }): Promise<FinishUploadResult> {
  const parsed = parseDetails(input);
  const path = libraryPathSchema.safeParse(input.path);
  if (!parsed.ok || !path.success) return { ok: false, message: "The upload details were not valid. Please start again." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: NOT_ALLOWED };
  if (!path.data.startsWith(`${parsed.details.courseId}/`) || !path.data.endsWith(`.${parsed.file.kind}`)) {
    return { ok: false, message: "The upload details were not valid. Please start again." };
  }

  const supabase = await createSupabaseServerClient();
  const download = await supabase.storage.from(BUCKET).download(path.data);
  if (download.error || !download.data) {
    logFailure("finishLibraryUpload.download", download.error?.name);
    return { ok: false, message: "The file did not arrive. Please upload it again." };
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const realKind: LibraryFileKind | null = detectFileKind(bytes);
  if (realKind !== parsed.file.kind || bytes.length > LIBRARY_MAX_BYTES) {
    await supabase.storage.from(BUCKET).remove([path.data]);
    return {
      ok: false,
      message: `That file is not a real ${LIBRARY_FILE_TYPES[parsed.file.kind].label}. Upload a PDF, Word (DOCX), PNG or JPEG file.`,
    };
  }

  const { error } = await supabase.from("kb_items").insert({
    title: parsed.details.title,
    type: parsed.details.type,
    course_id: parsed.details.courseId,
    campus: parsed.details.campus,
    year: parsed.details.year,
    source: parsed.details.source,
    storage_path: path.data,
    file_name: parsed.file.fileName,
    mime_type: LIBRARY_FILE_TYPES[realKind].mime,
    size_bytes: bytes.length,
  });
  if (error) {
    logFailure("finishLibraryUpload.insert", error.code);
    await supabase.storage.from(BUCKET).remove([path.data]);
    return { ok: false, message: "The item was not saved. Please try again." };
  }
  refresh();
  return { ok: true };
}

// Remove an item, its passages (by the database) and its file.
export async function removeLibraryItem(id: string): Promise<FinishUploadResult> {
  const parsedId = libraryItemIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, message: "That item could not be found." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can remove library items." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("kb_items").delete().eq("id", parsedId.data).select("storage_path");
  if (error) {
    logFailure("removeLibraryItem", error.code);
    return { ok: false, message: "The item was not removed. Please try again." };
  }
  if (data.length === 0) return { ok: false, message: "That item no longer exists." };
  const filePath = data[0].storage_path;
  if (filePath) {
    const removed = await supabase.storage.from(BUCKET).remove([filePath]);
    if (removed.error) logFailure("removeLibraryItem.file", removed.error.name);
  }
  refresh();
  return { ok: true };
}

// Files in a course folder with no library item, older than an hour (an interrupted upload).
async function removeLeftovers(courseId: string) {
  const supabase = await createSupabaseServerClient();
  const listed = await supabase.storage.from(BUCKET).list(courseId, { limit: 1000 });
  if (listed.error || !listed.data?.length) return;
  const items = await supabase.from("kb_items").select("storage_path").eq("course_id", courseId);
  if (items.error) return;
  const known = new Set(items.data.map((item) => item.storage_path));
  const cutoff = Date.now() - LEFTOVER_AFTER_MS;
  const leftovers = listed.data
    .filter((file) => !known.has(`${courseId}/${file.name}`))
    .filter((file) => file.created_at && new Date(file.created_at).getTime() < cutoff)
    .map((file) => `${courseId}/${file.name}`);
  if (leftovers.length > 0) await supabase.storage.from(BUCKET).remove(leftovers);
}
