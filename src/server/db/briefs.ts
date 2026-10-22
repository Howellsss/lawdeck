import "server-only";
import { parsePracticeSources, type PracticeSource } from "@/lib/practice";
import { briefIdSchema } from "@/schemas/brief";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { WorkspaceLoadError, type Loaded } from "./workspace";

// Reads for the Briefs screens (step 4f). Sign-in is checked first; row-level security keeps
// every brief to its owner.

export type BriefSummary = { id: string; kind: "case" | "statute"; name: string; createdAt: string };
export type BriefView = BriefSummary & {
  sections: { heading: string; text: string; covered: boolean }[];
  sources: PracticeSource[];
};

function failed(what: string, code: string | undefined): never {
  console.error("brief read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

export async function listBriefs(): Promise<Loaded<BriefSummary[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("briefs").select("id, kind, name, created_at").order("created_at", { ascending: false }).limit(200);
  if (error) failed("briefs", error.code);
  return { status: "ok", data: data.map((b) => ({ id: b.id, kind: b.kind, name: b.name, createdAt: b.created_at })) };
}

export async function getBrief(id: string): Promise<Loaded<BriefView | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!briefIdSchema.safeParse(id).success) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("briefs").select("id, kind, name, sections, sources, created_at").eq("id", id).maybeSingle();
  if (error) failed("brief", error.code);
  if (!data) return { status: "ok", data: null };
  return {
    status: "ok",
    data: {
      id: data.id,
      kind: data.kind,
      name: data.name,
      createdAt: data.created_at,
      sections: parseSections(data.sections),
      sources: parsePracticeSources(data.sources),
    },
  };
}

export function parseSections(value: unknown): BriefView["sections"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { heading, text, covered } = entry as Record<string, unknown>;
    if (typeof heading !== "string" || typeof text !== "string") return [];
    return [{ heading, text, covered: covered === true }];
  });
}
