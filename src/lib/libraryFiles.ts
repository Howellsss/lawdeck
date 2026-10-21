// Files the library accepts (CLAUDE.md, Security): PDF, Word (DOCX), PNG and JPEG, up to 25 MB.
// The real type is read from the file's first bytes, never trusted from its name.

export const LIBRARY_MAX_BYTES = 25 * 1024 * 1024;

export const LIBRARY_FILE_TYPES = {
  pdf: { mime: "application/pdf", label: "PDF" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word (DOCX)" },
  png: { mime: "image/png", label: "PNG image" },
  jpeg: { mime: "image/jpeg", label: "JPEG image" },
} as const;

export type LibraryFileKind = keyof typeof LIBRARY_FILE_TYPES;

export const LIBRARY_ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg";

// What the file's name says it is. Only used for a quick check before uploading.
export function kindFromFileName(name: string): LibraryFileKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function contains(bytes: Uint8Array, text: string): boolean {
  const needle = Array.from(text, (char) => char.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

// What the file really is, from its contents.
export function detectFileKind(bytes: Uint8Array): LibraryFileKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // "%PDF-"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  // A DOCX is a zip file that contains word/document.xml.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && contains(bytes, "word/document.xml")) return "docx";
  return null;
}
