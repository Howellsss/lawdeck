import "server-only";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { projectIdSchema } from "@/schemas/projects";

// Ids in addresses are checked to be UUIDs before any database call.

// Reads for the workspace screens. Each one checks sign-in on the server first;
// row-level security in the database is the final guard.

export type ProjectSummary = { id: string; name: string; updatedAt: string };
export type ChatSummary = { id: string; title: string; updatedAt: string };
export type CourseSummary = { id: string; slug: string; name: string };

export type Loaded<T> = { status: "signed-out" } | { status: "ok"; data: T };

export class WorkspaceLoadError extends Error {
  constructor(what: string) {
    super(`Could not load ${what}.`);
    this.name = "WorkspaceLoadError";
  }
}

// Logs the table and the error code only, never row contents (rule I-03).
function failed(what: string, code: string | undefined): never {
  console.error("workspace read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

export async function listProjects(): Promise<Loaded<ProjectSummary[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) failed("projects", error.code);
  return { status: "ok", data: data.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updated_at })) };
}

export async function getProject(
  id: string,
): Promise<Loaded<{ project: ProjectSummary; chats: ChatSummary[] } | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!projectIdSchema.safeParse(id).success) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();

  const project = await supabase.from("projects").select("id, name, updated_at").eq("id", id).maybeSingle();
  if (project.error) failed("project", project.error.code);
  if (!project.data) return { status: "ok", data: null };

  const chats = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("project_id", id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (chats.error) failed("project chats", chats.error.code);

  return {
    status: "ok",
    data: {
      project: { id: project.data.id, name: project.data.name, updatedAt: project.data.updated_at },
      chats: chats.data.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at })),
    },
  };
}

export async function listRecentChats(limit = 20): Promise<Loaded<ChatSummary[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) failed("recent chats", error.code);
  return { status: "ok", data: data.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at })) };
}

export async function listCourses(): Promise<Loaded<CourseSummary[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("courses").select("id, slug, name").order("position");
  if (error) failed("courses", error.code);
  return { status: "ok", data };
}

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; createdAt: string };

// The text part of a stored message. Other structured parts are added in Phase 3.
function messageText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}

export async function getChat(
  id: string,
): Promise<Loaded<{ chat: ChatSummary; messages: ChatMessage[] } | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!projectIdSchema.safeParse(id).success) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();

  const chat = await supabase.from("conversations").select("id, title, updated_at").eq("id", id).maybeSingle();
  if (chat.error) failed("chat", chat.error.code);
  if (!chat.data) return { status: "ok", data: null };

  const messages = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at")
    .limit(500);
  if (messages.error) failed("chat messages", messages.error.code);

  return {
    status: "ok",
    data: {
      chat: { id: chat.data.id, title: chat.data.title, updatedAt: chat.data.updated_at },
      messages: messages.data.map((m) => ({
        id: m.id,
        role: m.role,
        text: messageText(m.content),
        createdAt: m.created_at,
      })),
    },
  };
}
