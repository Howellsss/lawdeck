import "server-only";
import { formatWat } from "@/lib/dates";
import type { ExportRequest } from "@/schemas/exports";
import { getBrief } from "@/server/db/briefs";
import { getPracticeSet } from "@/server/db/practice";
import { getChat, type Loaded } from "@/server/db/workspace";
import { briefSheet, chatSheet, practiceSheet, type StudySheet } from "./sheet";

// The study sheet for one of the signed-in student's own chats, briefs or practice sets. Each
// read checks sign-in; row-level security returns the student's own rows only, so anyone else's
// id is simply "not found".
export async function loadSheet(request: ExportRequest): Promise<Loaded<StudySheet | null>> {
  // Read the clock only after the sign-in check (the reads below), so Next.js never tries to
  // pre-build this page with a fixed time.
  const when = () => `exported ${formatWat(new Date())}`;
  if (request.kind === "chat") {
    const result = await getChat(request.id);
    if (result.status !== "ok") return result;
    return { status: "ok", data: result.data ? chatSheet(result.data.chat, result.data.messages, when()) : null };
  }
  if (request.kind === "brief") {
    const result = await getBrief(request.id);
    if (result.status !== "ok") return result;
    return { status: "ok", data: result.data ? briefSheet(result.data, when()) : null };
  }
  const result = await getPracticeSet(request.id);
  if (result.status !== "ok") return result;
  return { status: "ok", data: result.data ? practiceSheet(result.data, when(), request.notKnown) : null };
}

// Where each kind lives in the workspace, for "Back" links.
export const EXPORT_HOME = { chat: "/chats", brief: "/briefs", practice: "/practice" } as const;

// A safe file name from the title: letters, numbers, spaces and hyphens only.
export function exportFileName(title: string): string {
  return title.replace(/[^A-Za-z0-9 -]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "Lawdeck notes";
}
