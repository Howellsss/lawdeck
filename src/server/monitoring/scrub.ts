// What an error report may say (step 7e, rule I-03): never document text, uploads, names, emails,
// phone numbers or keys. Messages are cut short and anything that looks personal or secret is
// blanked before a report leaves Lawdeck.

const MESSAGE_MAX = 200;

export function scrubMessage(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    // Keys and tokens: long runs of letters, digits and _ - . with at least one digit.
    .replace(/\b(?=[\w.-]*\d)[\w.-]{24,}\b/g, "[secret]")
    // Phone numbers and other long numbers.
    .replace(/\+?\d[\d\s-]{6,}\d/g, "[number]")
    // Quoted text may be what someone typed.
    .replace(/"[^"]{20,}"|'[^']{20,}'|“[^”]{20,}”/g, "[text]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MESSAGE_MAX);
}

// A page address with ids, share codes and the query string removed, e.g. /documents/:id.
export function scrubPath(path: string): string {
  const bare = path.split(/[?#]/)[0] ?? "";
  return (
    bare
      .split("/")
      .map((part) => (/^[0-9a-f-]{16,}$/i.test(part) || /^[\w-]{20,}$/.test(part) ? ":id" : part))
      .join("/")
      .slice(0, 120) || "/"
  );
}

// Error type names only: letters and digits, as in "TypeError".
export function scrubType(name: unknown): string {
  return typeof name === "string" && /^[A-Za-z][\w$]{0,59}$/.test(name) ? name : "Error";
}
