// Google Drive links pasted by an admin (founder, 2026-11-08): pulls out each file or folder id.
// Accepts the usual shapes: drive.google.com/file/d/<id>/…, …/open?id=<id>, …/uc?id=<id>,
// …/drive/folders/<id>, …/drive/u/0/folders/<id>, and docs.google.com/document/d/<id>/….
// Anything else is listed as not understood. Only Google's own addresses are accepted.

export type DriveLink = { id: string; folder: boolean };

const ID = /^[A-Za-z0-9_-]{10,200}$/;
const HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export function parseDriveLink(raw: string): DriveLink | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const after = (word: string) => {
    const i = parts.indexOf(word);
    return i >= 0 ? parts[i + 1] : undefined;
  };
  const folder = after("folders");
  if (folder && ID.test(folder)) return { id: folder, folder: true };
  const file = after("d");
  if (file && ID.test(file)) return { id: file, folder: false };
  const query = url.searchParams.get("id");
  if (query && ID.test(query)) return { id: query, folder: false };
  return null;
}

// Every link in a pasted block (one per line, or separated by spaces or commas), without repeats.
export function parseDriveLinks(text: string): { links: DriveLink[]; notUnderstood: string[] } {
  const seen = new Set<string>();
  const links: DriveLink[] = [];
  const notUnderstood: string[] = [];
  for (const piece of text.split(/[\s,]+/)) {
    if (!piece) continue;
    const link = parseDriveLink(piece);
    if (!link) {
      notUnderstood.push(piece.slice(0, 120));
      continue;
    }
    if (seen.has(link.id)) continue;
    seen.add(link.id);
    links.push(link);
  }
  return { links, notUnderstood };
}
