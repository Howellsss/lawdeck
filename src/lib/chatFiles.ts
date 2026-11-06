import { kindFromFileName, LIBRARY_MAX_BYTES } from "./libraryFiles";

// Files in campus chat (docs/specs/chat.md): PDF, Word (DOCX), PNG and JPEG, 25 MB each, up to 4 a message.
export const CHAT_MAX_FILES = 4;
export const CHAT_FILE_ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg";

export type ChatFileKind = "pdf" | "docx" | "png" | "jpeg";

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
export const kindLabel = (kind: ChatFileKind) => ({ pdf: "PDF", docx: "Word", png: "Image", jpeg: "Image" })[kind];
