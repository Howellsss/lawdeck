// How a group is greeted when it has no messages yet (founder, 2026-11-06): a campus group is
// "NLS Abuja Campus", not just "Abuja".
export function welcomeName(kind: "all" | "campus" | "aspirants" | "study", name: string): string {
  return kind === "campus" ? `NLS ${name} Campus` : name;
}
