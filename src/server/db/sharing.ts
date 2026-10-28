import "server-only";
import type { AnswerLevel } from "@/prompts/explain";
import { shareTokenSchema, sharedItemSchema, type ShareKind } from "@/schemas/sharing";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { drawDocument } from "@/server/documents/drawable";
import type { DocModel } from "@/server/documents/render";
import { WorkspaceLoadError, type Loaded } from "./workspace";

// Reading view-only share links (Phase 6, step 6d; PRD EX-04). The owner's own links come from
// the shares table (row-level security); everything a viewer sees comes through the database's
// share functions, which check the link is still live on every read. Viewers must be signed in.

export type ShareViewer = { name: string; firstSeenAt: string; lastSeenAt: string };
export type OwnShare = { id: string; token: string; createdAt: string; viewers: ShareViewer[] };
export type OpenedShare = {
  kind: ShareKind;
  title: string;
  documentId: string | null;
  projectId: string | null;
  sharedAt: string;
  isOwner: boolean;
};
export type SharedItem = { kind: "document" | "chat"; id: string; title: string; updatedAt: string };
export type SharedDocument = { title: string; forumName: string | null; updatedAt: string; model: DocModel | null };
export type SharedSource = { label: number; title: string; origin: "library" | "upload" };
export type SharedMessage = {
  role: "user" | "assistant";
  text: string;
  level: AnswerLevel | null;
  createdAt: string;
  sources: SharedSource[];
};

// Logs what was being read and the error code only, never contents (rule I-03).
function failed(what: string, code: string | undefined): never {
  console.error("sharing read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

// The signed-in student's live links to one of their documents or projects, with who opened each.
export async function listShares(kind: ShareKind, id: string): Promise<OwnShare[]> {
  if (!(await getCurrentAccount())) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shares")
    .select("id, token, created_at")
    .eq(kind === "document" ? "document_id" : "project_id", id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) failed("share links", error.code);
  return Promise.all(
    data.map(async (share) => {
      const viewers = await supabase.rpc("share_viewers", { share: share.id });
      if (viewers.error) failed("share viewers", viewers.error.code);
      return {
        id: share.id,
        token: share.token,
        createdAt: share.created_at,
        viewers: viewers.data.map((v) => ({ name: v.viewer_name, firstSeenAt: v.first_seen_at, lastSeenAt: v.last_seen_at })),
      };
    }),
  );
}

// Opens a link (and records the viewer). Null when the link is not valid or was turned off.
export async function openShare(token: string): Promise<Loaded<OpenedShare | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const parsed = shareTokenSchema.safeParse(token);
  if (!parsed.success) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("open_share", { share_token: parsed.data });
  if (error) failed("share", error.code);
  const share = data[0];
  if (!share) return { status: "ok", data: null };
  return {
    status: "ok",
    data: {
      kind: share.kind,
      title: share.title ?? "Shared work",
      documentId: share.document_id,
      projectId: share.project_id,
      sharedAt: share.shared_at,
      isOwner: share.is_owner,
    },
  };
}

// A shared project's documents and chats.
export async function listSharedItems(token: string): Promise<SharedItem[]> {
  const parsed = shareTokenSchema.safeParse(token);
  if (!parsed.success) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("shared_project_items", { share_token: parsed.data });
  if (error) failed("shared project", error.code);
  return data.map((item) => ({ kind: item.item_kind, id: item.id, title: item.title, updatedAt: item.updated_at }));
}

// One shared document, drawn as pages (only with reviewed templates and courts).
export async function getSharedDocument(token: string, id: string): Promise<SharedDocument | null> {
  const parsed = sharedItemSchema.safeParse({ token, id });
  if (!parsed.success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("shared_document", { share_token: parsed.data.token, document: parsed.data.id });
  if (error) failed("shared document", error.code);
  const row = data[0];
  if (!row) return null;
  const { model } = drawDocument({
    title: row.title,
    hasForum: row.forum_slug !== null,
    template: row.template_status ? { spec: row.template_spec, status: row.template_status } : null,
    forum: row.forum_slug && row.forum_status ? { slug: row.forum_slug, profile: row.forum_profile, status: row.forum_status } : null,
    content: row.content,
  });
  return { title: row.title, forumName: row.forum_name, updatedAt: row.updated_at, model };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sources(value: unknown): SharedSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const s = record(entry);
    return typeof s.label === "number" && typeof s.title === "string"
      ? [{ label: s.label, title: s.title, origin: s.origin === "upload" ? ("upload" as const) : ("library" as const) }]
      : [];
  });
}

// One chat in a shared project: its questions and answers, with the titles of their sources.
export async function getSharedChat(token: string, id: string): Promise<SharedMessage[]> {
  const parsed = sharedItemSchema.safeParse({ token, id });
  if (!parsed.success) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("shared_chat_messages", { share_token: parsed.data.token, chat: parsed.data.id });
  if (error) failed("shared chat", error.code);
  return data.map((m) => {
    const content = record(m.content);
    return {
      role: m.role,
      text: typeof content.text === "string" ? content.text : "",
      level: content.level === "simple" || content.level === "exam" || content.level === "talk" ? content.level : null,
      createdAt: m.created_at,
      sources: sources(m.sources),
    };
  });
}
