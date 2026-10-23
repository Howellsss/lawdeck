import { z } from "@/lib/zod";
import { libraryFileSchema } from "./library";

// Students' private uploads (Phase 6, step 6a; PRD UP-01): the same file rules as the library
// (PDF, Word, PNG, JPEG; 25 MB at most; real type checked on the server, rule F-02).
export const uploadFileSchema = libraryFileSchema;

export const uploadIdSchema = z.uuid({ error: "That file could not be found." });

// Where a student's file lives: "<their id>/<file id>.<kind>".
export const uploadPathSchema = z
  .string()
  .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|docx|png|jpeg)$/, { error: "Upload not recognised." });

// What the screens call each status.
export const UPLOAD_STATUS_LABELS = { processing: "Waiting to be read", ready: "Ready", failed: "Could not be read" } as const;
