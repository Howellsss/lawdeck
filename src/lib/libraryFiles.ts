// Files students may upload (CLAUDE.md, Security): PDF, Word (DOCX), PNG and JPEG, up to 25 MB.
// Library files added by admins may also be PowerPoint (.pptx) and up to 100 MB (founder,
// 2026-11-22; see ADMIN_LIBRARY_* below). The real type is read from the file's contents, never
// trusted from its name.

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

// What a student's file really is, from its contents. Never "pptx": students cannot upload slides.
export function detectFileKind(bytes: Uint8Array): LibraryFileKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // "%PDF-"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  // A DOCX is a zip file that contains word/document.xml.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && contains(bytes, "word/document.xml")) return "docx";
  return null;
}

// Library files added by admins (Admin → Library and the Drive import): also PowerPoint, and up to
// 100 MB (founder, 2026-11-22: lecture slides and large scanned handbooks). Students' own uploads
// keep the 25 MB limit and the four kinds above.
export const ADMIN_LIBRARY_MAX_BYTES = 100 * 1024 * 1024;

export const ADMIN_LIBRARY_FILE_TYPES = {
  ...LIBRARY_FILE_TYPES,
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PowerPoint (PPTX)" },
} as const;

export type AdminLibraryFileKind = keyof typeof ADMIN_LIBRARY_FILE_TYPES;

export const ADMIN_LIBRARY_ACCEPT = `${LIBRARY_ACCEPT},.pptx`;

export const ADMIN_LIBRARY_KINDS_TEXT = "a PDF, Word (DOCX), PowerPoint (PPTX), PNG or JPEG file";

// Old PowerPoint files (.ppt) use a different format Lawdeck cannot read.
export const OLD_POWERPOINT_MESSAGE =
  "Old PowerPoint files (.ppt) can't be read. Open it in PowerPoint or Google Slides and save or download it as .pptx, then import that.";

export function adminKindFromFileName(name: string): AdminLibraryFileKind | null {
  if (name.toLowerCase().endsWith(".pptx")) return "pptx";
  return kindFromFileName(name);
}

export function isOldPowerPoint(name: string): boolean {
  return name.toLowerCase().endsWith(".ppt");
}

// What a library file really is: a student kind, or a PowerPoint (a zip holding ppt/presentation.xml).
export function detectAdminLibraryKind(bytes: Uint8Array): AdminLibraryFileKind | null {
  const kind = detectFileKind(bytes);
  if (kind) return kind;
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && contains(bytes, "ppt/presentation.xml")) return "pptx";
  return null;
}
