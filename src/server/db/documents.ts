import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PROFILE,
  documentContentSchema,
  draftingIdSchema,
  forumProfileSchema,
  templateSpecSchema,
  type TemplateField,
  type TemplateSpec,
} from "@/schemas/drafting";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { checkDocument, type CheckIssue } from "@/server/documents/checks";
import { buildDocument, type DocModel } from "@/server/documents/render";
import type { Database } from "./types";
import { WorkspaceLoadError, type Loaded } from "./workspace";

// Reads for the student's drafting screens (step 5d): the catalogue of approved templates, one
// template's intake, and the student's own documents. Sign-in is checked first; row-level security
// gives students approved templates and courts only, and documents to their owner only.

type Db = SupabaseClient<Database>;

export type CatalogueCourse = { slug: string; name: string; templates: { slug: string; title: string }[] };
export type IntakeForum = { id: string; name: string };
export type IntakeView = {
  id: string;
  title: string;
  courseName: string;
  forums: IntakeForum[];
  fields: TemplateField[];
  aiParts: number;
};
export type DocumentSummary = { id: string; title: string; forumName: string | null; updatedAt: string };
export type DocumentView = DocumentSummary & {
  createdAt: string;
  model: DocModel | null;
  issues: CheckIssue[];
};

function failed(what: string, code: string | undefined): never {
  console.error("documents read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

// Approved templates by course, in course order (DR-01).
export async function listCatalogue(): Promise<Loaded<CatalogueCourse[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const [templates, courses] = await Promise.all([
    supabase.from("templates").select("slug, title, course_id").eq("status", "approved").order("title").limit(500),
    supabase.from("courses").select("id, slug, name, position").order("position"),
  ]);
  if (templates.error) failed("templates", templates.error.code);
  if (courses.error) failed("courses", courses.error.code);
  return {
    status: "ok",
    data: courses.data
      .map((course) => ({
        slug: course.slug,
        name: course.name,
        templates: templates.data.filter((t) => t.course_id === course.id).map((t) => ({ slug: t.slug, title: t.title })),
      }))
      .filter((course) => course.templates.length > 0),
  };
}

// One approved template's intake: its questions and the courts or registries it can be drafted for.
export async function getIntake(slug: string): Promise<Loaded<IntakeView | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("templates")
    .select("id, title, course_id, spec")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (error) failed("template", error.code);
  if (!data) return { status: "ok", data: null };
  const spec = templateSpecSchema.safeParse(data.spec);
  if (!spec.success) return { status: "ok", data: null };
  const [course, forums] = await Promise.all([
    supabase.from("courses").select("name").eq("id", data.course_id).maybeSingle(),
    approvedForums(supabase, data.id),
  ]);
  if (course.error) failed("course", course.error.code);
  return {
    status: "ok",
    data: {
      id: data.id,
      title: data.title,
      courseName: course.data?.name ?? "",
      forums,
      fields: spec.data.fields,
      aiParts: spec.data.parts.filter((part) => part.kind === "narrative").length,
    },
  };
}

async function approvedForums(supabase: Db, templateId: string): Promise<IntakeForum[]> {
  const links = await supabase.from("template_forums").select("forum_id").eq("template_id", templateId);
  if (links.error) failed("forums", links.error.code);
  if (links.data.length === 0) return [];
  const forums = await supabase
    .from("forums")
    .select("id, name, profile")
    .in("id", links.data.map((link) => link.forum_id))
    .eq("status", "approved")
    .order("name");
  if (forums.error) failed("forums", forums.error.code);
  return forums.data.filter((f) => forumProfileSchema.safeParse(f.profile).success).map((f) => ({ id: f.id, name: f.name }));
}

export async function listDocuments(): Promise<Loaded<DocumentSummary[]>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, forum_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) failed("documents", error.code);
  const names = await forumNames(supabase, data.map((d) => d.forum_id));
  return {
    status: "ok",
    data: data.map((d) => ({ id: d.id, title: d.title, forumName: d.forum_id ? (names.get(d.forum_id) ?? null) : null, updatedAt: d.updated_at })),
  };
}

// One of the student's documents, drawn by the document engine with its automatic checks (DR-06).
// The model is null while its template or court is not approved (the saved text is kept).
export async function getDocument(id: string): Promise<Loaded<DocumentView | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  if (!draftingIdSchema.safeParse(id).success) return { status: "ok", data: null };
  const supabase = await createSupabaseServerClient();
  const loaded = await loadDocument(supabase, id);
  if (!loaded) return { status: "ok", data: null };
  const { document, model, spec, content } = loaded;
  return {
    status: "ok",
    data: {
      id: document.id,
      title: document.title,
      forumName: loaded.forumName,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
      model,
      issues: model && spec && content ? checkDocument(spec, content, model) : [],
    },
  };
}

// The document model for one of the signed-in student's documents (also used for the Word file).
export async function loadDocument(supabase: Db, id: string) {
  const document = await supabase
    .from("documents")
    .select("id, title, template_id, forum_id, current_version_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (document.error) failed("document", document.error.code);
  if (!document.data) return null;
  const doc = document.data;
  const [version, template, forum] = await Promise.all([
    doc.current_version_id
      ? supabase.from("document_versions").select("content").eq("id", doc.current_version_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    doc.template_id
      ? supabase.from("templates").select("spec, status").eq("id", doc.template_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    doc.forum_id
      ? supabase.from("forums").select("slug, name, profile, status").eq("id", doc.forum_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (version.error) failed("version", version.error.code);
  if (template.error) failed("document template", template.error.code);
  if (forum.error) failed("court", forum.error.code);
  const content = documentContentSchema.safeParse(version.data?.content ?? {});
  // Unreviewed wording is never shown (CLAUDE.md): a template or court sent back for review, or
  // removed, is not drawn until it is approved again. The student's facts and text stay saved.
  const spec = template.data?.status === "approved" ? templateSpecSchema.safeParse(template.data.spec) : null;
  const forumUsable = !doc.forum_id || forum.data?.status === "approved";
  const profile = forum.data && forumUsable ? forumProfileSchema.safeParse(forum.data.profile) : null;
  const model: DocModel | null =
    content.success && spec?.success && forumUsable && (!doc.forum_id || profile?.success)
      ? buildDocument({
          title: doc.title,
          spec: spec.data,
          profile: profile?.success ? profile.data : DEFAULT_PROFILE,
          forumSlug: forum.data?.slug ?? null,
          content: content.data,
        })
      : null;
  return {
    document: doc,
    forumName: forum.data?.name ?? null,
    model,
    spec: model && spec?.success ? (spec.data as TemplateSpec) : null,
    content: content.success ? content.data : null,
  };
}

async function forumNames(supabase: Db, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (wanted.length === 0) return new Map();
  const { data, error } = await supabase.from("forums").select("id, name").in("id", wanted);
  if (error) failed("courts", error.code);
  return new Map(data.map((f) => [f.id, f.name]));
}
