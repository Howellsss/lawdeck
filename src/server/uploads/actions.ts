"use server";

import { refresh } from "next/cache";
import {
  detectFileKind,
  LIBRARY_FILE_TYPES,
  LIBRARY_MAX_BYTES,
} from "@/lib/libraryFiles";
import {
  uploadFileSchema,
  uploadIdSchema,
  uploadPathSchema,
} from "@/schemas/uploads";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { uploadStep, type UploadStepResult } from "./reading";

// A student's private uploads (Phase 6, step 6a; PRD UP-01, UP-02, UP-05, UP-06). Sign-in and
// input are checked here on the server; the database and file store keep every file inside the
// student's own folder, refuse uploads before the notice is accepted, and stop at the plan's limit.
// Logs never contain file names or contents (rule I-03).

const BUCKET = "uploads";
// Files uploaded but never finished are removed after this long.
const LEFTOVER_AFTER_MS = 60 * 60 * 1000;
const SIGN_IN = "Sign in to upload your own material.";

export type UploadFileInput = { fileName: string; size: number; kind: string };
export type StartResult =
  | { ok: true; path: string; signedUrl: string }
  | { ok: false; message: string; needsNotice?: boolean };
export type SimpleResult = { ok: true } | { ok: false; message: string };
export type FinishResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

function logFailure(action: string, code: string | undefined) {
  console.error("upload action failed", { action, code: code ?? "unknown" });
}

// The notice (PRD Appendix C) is accepted once; the database records when.
export async function acceptUploadNotice(): Promise<SimpleResult> {
  if (!(await getCurrentAccount())) return { ok: false, message: SIGN_IN };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_upload_notice");
  if (error) {
    logFailure("acceptNotice", error.code);
    return { ok: false, message: "That did not save. Please try again." };
  }
  refresh();
  return { ok: true };
}

// Step 1: check the file's details and give the browser a one-time link to put it in the
// student's own folder (Vercel cannot carry 25 MB files itself).
export async function startUpload(
  input: UploadFileInput,
): Promise<StartResult> {
  const file = uploadFileSchema.safeParse(input);
  if (!file.success)
    return {
      ok: false,
      message:
        file.error.issues[0]?.message ??
        "Upload a PDF, Word (DOCX), PNG or JPEG file.",
    };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, message: SIGN_IN };
  const supabase = await createSupabaseServerClient();
  const notice = await supabase.rpc("upload_notice_accepted");
  if (notice.error) {
    logFailure("startUpload.notice", notice.error.code);
    return {
      ok: false,
      message: "The upload could not start. Please try again.",
    };
  }
  if (notice.data !== true)
    return {
      ok: false,
      needsNotice: true,
      message: "Read and accept the notice before your first upload.",
    };

  await removeLeftovers(account.id);
  const path = `${account.id}/${crypto.randomUUID()}.${file.data.kind}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    logFailure("startUpload.sign", error?.name);
    return {
      ok: false,
      message: "The upload could not start. Please try again.",
    };
  }
  return { ok: true, path, signedUrl: data.signedUrl };
}

// Step 2: once the browser has uploaded, check the file really is what it claims to be and is
// within the size limit, then record it. Anything wrong: the file is removed.
export async function finishUpload(
  input: UploadFileInput & { path: string },
): Promise<FinishResult> {
  const file = uploadFileSchema.safeParse(input);
  const path = uploadPathSchema.safeParse(input.path);
  if (!file.success || !path.success)
    return {
      ok: false,
      message: "The upload details were not valid. Please start again.",
    };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, message: SIGN_IN };
  if (
    !path.data.startsWith(`${account.id}/`) ||
    !path.data.endsWith(`.${file.data.kind}`)
  )
    return {
      ok: false,
      message: "The upload details were not valid. Please start again.",
    };

  const supabase = await createSupabaseServerClient();
  const download = await supabase.storage.from(BUCKET).download(path.data);
  if (download.error || !download.data) {
    logFailure("finishUpload.download", download.error?.name);
    return {
      ok: false,
      message: "The file did not arrive. Please upload it again.",
    };
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const realKind = detectFileKind(bytes);
  if (realKind !== file.data.kind || bytes.length > LIBRARY_MAX_BYTES) {
    await supabase.storage.from(BUCKET).remove([path.data]);
    return {
      ok: false,
      message: `That file is not a real ${LIBRARY_FILE_TYPES[file.data.kind].label}. Upload a PDF, Word (DOCX), PNG or JPEG file.`,
    };
  }

  const { data, error } = await supabase
    .from("uploads")
    .insert({
      file_name: file.data.fileName,
      mime_type: LIBRARY_FILE_TYPES[realKind].mime,
      size_bytes: bytes.length,
      storage_path: path.data,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path.data]);
    if (error.code === "23514")
      return {
        ok: false,
        message:
          "You have reached your plan’s limit of files. Delete a file to add another.",
      };
    if (error.code === "42501")
      return {
        ok: false,
        message: "Read and accept the notice before your first upload.",
      };
    logFailure("finishUpload.insert", error.code);
    return { ok: false, message: "The file was not saved. Please try again." };
  }
  refresh();
  return { ok: true, id: data.id };
}

// Deletes the file from storage, then its record and passages, so it leaves search at once
// (PRD UP-05).
export async function deleteUpload(id: string): Promise<SimpleResult> {
  if (!uploadIdSchema.safeParse(id).success)
    return { ok: false, message: "That file could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: SIGN_IN };
  const supabase = await createSupabaseServerClient();
  const found = await supabase
    .from("uploads")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (found.error || !found.data)
    return { ok: false, message: "That file could not be found." };
  const removed = await supabase.storage
    .from(BUCKET)
    .remove([found.data.storage_path]);
  if (removed.error) {
    logFailure("deleteUpload.file", removed.error.name);
    return {
      ok: false,
      message: "The file was not deleted. Please try again.",
    };
  }
  const { data, error } = await supabase
    .from("uploads")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.length) {
    logFailure("deleteUpload.row", error?.code);
    return {
      ok: false,
      message: "The file was not deleted. Please try again.",
    };
  }
  refresh();
  return { ok: true };
}

// Files the student started uploading but never finished, over an hour old.
async function removeLeftovers(ownerId: string) {
  const supabase = await createSupabaseServerClient();
  const listed = await supabase.storage
    .from(BUCKET)
    .list(ownerId, { limit: 1000 });
  if (listed.error || !listed.data?.length) return;
  const rows = await supabase.from("uploads").select("storage_path");
  if (rows.error) return;
  const known = new Set(rows.data.map((row) => row.storage_path));
  const cutoff = Date.now() - LEFTOVER_AFTER_MS;
  const leftovers = listed.data
    .filter((f) => !known.has(`${ownerId}/${f.name}`))
    .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => `${ownerId}/${f.name}`);
  if (leftovers.length > 0)
    await supabase.storage.from(BUCKET).remove(leftovers);
}

// Reads an upload one step at a time (see ./reading.ts). The screen calls it until it is done.
export async function readUpload(id: string): Promise<UploadStepResult> {
  if (!uploadIdSchema.safeParse(id).success)
    return { ok: false, message: "That file could not be found." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, message: SIGN_IN };
  const supabase = await createSupabaseServerClient();
  const result = await uploadStep(supabase, id, account.id);
  if (!result.ok || result.done) refresh();
  return result;
}
