import { kindFromFileName, LIBRARY_MAX_BYTES } from "./libraryFiles";

// Files in campus chat (docs/specs/chat.md): PDF, Word (DOCX), PNG and JPEG, 25 MB each, up to 4 a message.
export const CHAT_MAX_FILES = 4;
export const CHAT_FILE_ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg";

export type ChatFileKind = "pdf" | "docx" | "png" | "jpeg" | "voice";

// Why a picked file can't be attached, or null when it can (the server checks the real type again).
export function chatFileProblem(name: string, size: number, alreadyAttached: number): string | null {
  if (alreadyAttached >= CHAT_MAX_FILES) return `Attach up to ${CHAT_MAX_FILES} files to a message.`;
  if (!kindFromFileName(name)) return `“${name}” can’t be attached. Attach a PDF, Word (DOCX), PNG or JPEG file.`;
  if (size > LIBRARY_MAX_BYTES) return `“${name}” is larger than 25 MB.`;
  if (size < 1) return `“${name}” is empty.`;
  return null;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

export const isImage = (kind: ChatFileKind) => kind === "png" || kind === "jpeg";
export const kindLabel = (kind: ChatFileKind) => ({ pdf: "PDF", docx: "Word", png: "Image", jpeg: "Image", voice: "Voice note" })[kind];

// Voice notes (study groups only; founder, 2026-11-06): up to 2 minutes and 5 MB.
export const VOICE_MAX_SECONDS = 120;
export const VOICE_MAX_BYTES = 5 * 1024 * 1024;
export type VoiceFormat = "webm" | "ogg" | "m4a";
export const VOICE_TYPES: Record<VoiceFormat, string> = { webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4" };

// The recording format this browser can make (Chrome and Android: WebM; Firefox: Ogg; iPhone: MP4).
export function voiceFormatFor(mimeType: string): VoiceFormat | null {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (base === "audio/webm" || base === "video/webm") return "webm";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mp4" || base === "video/mp4" || base === "audio/aac" || base === "audio/x-m4a") return "m4a";
  return null;
}

// What kind of audio a recording really is, from its first bytes (never from its name).
export function detectAudioKind(bytes: Uint8Array): VoiceFormat | null {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (at(0, [0x1a, 0x45, 0xdf, 0xa3])) return "webm"; // Matroska / WebM
  if (at(0, [0x4f, 0x67, 0x67, 0x53])) return "ogg"; // "OggS"
  if (at(4, [0x66, 0x74, 0x79, 0x70])) return "m4a"; // "ftyp" box of an MP4 file
  return null;
}

// "1:05" from seconds.
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
