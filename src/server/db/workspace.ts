import "server-only";
import { pagesLabel } from "@/lib/pages";
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

export type TopicSummary = { id: string; slug: string; name: string; position: number };

// One course and its topics in teaching order, for the course hub (PRD LN-05).
export async function getCourseHub(
  slug: string,
): Promise<Loaded<{ course: CourseSummary; topics: TopicSummary[] } | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();
  const course = await supabase.from("courses").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (course.error) failed("course", course.error.code);
  if (!course.data) return { status: "ok", data: null };
  const topics = await supabase
    .from("topics")
    .select("id, slug, name, position")
    .eq("course_id", course.data.id)
    .order("position")
    .order("name")
    .limit(500);
  if (topics.error) failed("topics", topics.error.code);
  return { status: "ok", data: { course: course.data, topics: topics.data } };
}

export type ChatSource = { id: string; label: number; itemTitle: string; heading: string | null; pages: string | null };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  // Simple or Exam-ready (PRD LN-02); older messages have none.
  level: "simple" | "exam" | null;
  createdAt: string;
  sources: ChatSource[];
};

function messageLevel(content: unknown): "simple" | "exam" | null {
  const level = content && typeof content === "object" && "level" in content ? content.level : null;
  return level === "simple" || level === "exam" ? level : null;
}

// The text part of a stored message.
function messageText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}

export async function getChat(
  id: string,
): Promise<Loaded<{ chat: ChatSummary & { courseName: string | null; autoRouted: boolean }; messages: ChatMessage[] } | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!projectIdSchema.safeParse(id).success) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();

  const chat = await supabase.from("conversations").select("id, title, updated_at, course_id, auto_routed").eq("id", id).maybeSingle();
  if (chat.error) failed("chat", chat.error.code);
  if (!chat.data) return { status: "ok", data: null };

  const [messages, course] = await Promise.all([
    supabase.from("messages").select("id, role, content, created_at").eq("conversation_id", id).order("created_at").limit(500),
    chat.data.course_id
      ? supabase.from("courses").select("name").eq("id", chat.data.course_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (messages.error) failed("chat messages", messages.error.code);

  // The sources of the answers (Phase 3): the student's own rows only (row-level security).
  const answerIds = messages.data.filter((m) => m.role === "assistant").map((m) => m.id);
  const sources = answerIds.length
    ? await supabase
        .from("message_sources")
        .select("id, message_id, label, item_title, heading, page_from, page_to")
        .in("message_id", answerIds)
        .order("label")
    : { data: [], error: null };
  if (sources.error) failed("chat sources", sources.error.code);
  const byMessage = new Map<string, ChatSource[]>();
  for (const row of sources.data ?? []) {
    const list = byMessage.get(row.message_id) ?? [];
    list.push({ id: row.id, label: row.label, itemTitle: row.item_title, heading: row.heading, pages: pagesLabel(row.page_from, row.page_to) });
    byMessage.set(row.message_id, list);
  }

  return {
    status: "ok",
    data: {
      chat: {
        id: chat.data.id,
        title: chat.data.title,
        updatedAt: chat.data.updated_at,
        courseName: course.data?.name ?? null,
        autoRouted: chat.data.auto_routed,
      },
      messages: messages.data.map((m) => ({
        id: m.id,
        role: m.role,
        text: messageText(m.content),
        level: messageLevel(m.content),
        createdAt: m.created_at,
        sources: byMessage.get(m.id) ?? [],
      })),
    },
  };
}
