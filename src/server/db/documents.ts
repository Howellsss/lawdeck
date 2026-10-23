import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  draftingIdSchema,
  forumProfileSchema,
  templateFileSchema,
  partLabel,
  sharedFacts,
  templateSpecSchema,
  type TemplateField,
} from "@/schemas/drafting";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { checkDocument, type CheckIssue } from "@/server/documents/checks";
import { drawDocument, type DocumentLayout } from "@/server/documents/drawable";
import type { DocModel } from "@/server/documents/render";
import { TEMPLATE_FILES } from "@/templates";
import type { Database } from "./types";
import { WorkspaceLoadError, type Loaded } from "./workspace";

// Reads for the student's drafting screens (step 5d): the catalogue of approved templates, one
// template's intake, and the student's own documents. Sign-in is checked first; row-level security
// gives students approved templates and courts only, and documents to their owner only.

type Db = SupabaseClient<Database>;

export type CatalogueCourse = { slug: string; name: string; templates: { slug: string; title: string }[] };
export type IntakeForum = { id: string; slug: string; name: string };
// "Why is it arranged this way?" (DR-08): each part in order, what it does and the rule behind it.
export type WhyEntry = { partId: string; heading: string | null; why: string; onlyFor: string[] | null };
export type IntakeView = {
  id: string;
  title: string;
  courseName: string;
  forums: IntakeForum[];
  fields: TemplateField[];
  aiParts: number;
  why: WhyEntry[];
  // Answers carried over from one of the student's documents (DR-09), and its court.
  defaults: Record<string, string[]>;
  defaultForumId: string | null;
};
// A document that usually goes with this one (DR-09); available once its template is approved.
export type RelatedDocument = { slug: string; title: string; available: boolean };
export type DocumentSummary = { id: string; title: string; forumName: string | null; updatedAt: string };
export type EditablePartView = {
  id: string;
  heading: string | null;
  // The wording shown now, with {{fact}} stand-ins as stored; whether the student rewrote it.
  text: string;
  edited: boolean;
};
export type VersionSummary = { id: string; number: number; by: "student" | "ai"; createdAt: string; current: boolean };
export type DocumentView = DocumentSummary & {
  createdAt: string;
  model: DocModel | null;
  issues: CheckIssue[];
  // For editing (step 5e); empty while the document is being re-checked.
  fields: TemplateField[];
  facts: Record<string, string[]>;
  parts: EditablePartView[];
  versions: VersionSummary[];
  why: WhyEntry[];
  related: RelatedDocument[];
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
export async function getIntake(slug: string, fromDocumentId?: string): Promise<Loaded<IntakeView | null>> {
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
  const carried = fromDocumentId ? await carriedOver(supabase, fromDocumentId, spec.data.fields, forums) : null;
  const forumNames = new Map(forums.map((f) => [f.slug, f.name]));
  return {
    status: "ok",
    data: {
      id: data.id,
      title: data.title,
      courseName: course.data?.name ?? "",
      forums,
      fields: spec.data.fields,
      aiParts: spec.data.parts.filter((part) => part.kind === "narrative").length,
      why: spec.data.parts.map((part) => ({
        partId: part.id,
        heading: partLabel(part, spec.data.fields),
        why: part.why,
        onlyFor: part.forums ? part.forums.map((f) => forumNames.get(f) ?? f) : null,
      })),
      defaults: carried?.facts ?? {},
      defaultForumId: carried?.forumId ?? null,
    },
  };
}

// The answers a related document can reuse (DR-09): those of the student's own document whose
// questions are the same (same name), and its court if this template is for it too. Row-level
// security means only the student's own document can be read.
async function carriedOver(
  supabase: Db,
  documentId: string,
  fields: TemplateField[],
  forums: IntakeForum[],
): Promise<{ facts: Record<string, string[]>; forumId: string | null } | null> {
  if (!draftingIdSchema.safeParse(documentId).success) return null;
  const loaded = await loadDocument(supabase, documentId);
  if (!loaded?.content) return null;
  return {
    facts: sharedFacts(loaded.content.fields, fields),
    forumId: forums.some((f) => f.id === loaded.document.forum_id) ? loaded.document.forum_id : null,
  };
}


async function approvedForums(supabase: Db, templateId: string): Promise<IntakeForum[]> {
  const links = await supabase.from("template_forums").select("forum_id").eq("template_id", templateId);
  if (links.error) failed("forums", links.error.code);
  if (links.data.length === 0) return [];
  const forums = await supabase
    .from("forums")
    .select("id, slug, name, profile")
    .in("id", links.data.map((link) => link.forum_id))
    .eq("status", "approved")
    .order("name");
  if (forums.error) failed("forums", forums.error.code);
  return forums.data.filter((f) => forumProfileSchema.safeParse(f.profile).success).map((f) => ({ id: f.id, slug: f.slug, name: f.name }));
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
  const ready = model && spec && content ? { model, spec, content } : null;
  return {
    status: "ok",
    data: {
      id: document.id,
      title: document.title,
      forumName: loaded.forumName,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
      model,
      issues: ready ? checkDocument(ready.spec, ready.content, ready.model) : [],
      fields: ready ? ready.spec.fields : [],
      facts: ready
        ? Object.fromEntries(Object.entries(ready.content.fields).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]))
        : {},
      parts: ready
        ? ready.model.blocks
            .filter((block) => block.kind !== "signature")
            .map((block) => {
              const part = ready.spec.parts.find((p) => p.id === block.partId);
              const edited = ready.content.edits[block.partId];
              const original = block.kind === "narrative" ? (ready.content.narrative[block.partId] ?? "") : (part?.text ?? "");
              return { id: block.partId, heading: block.heading, text: edited ?? original, edited: edited !== undefined };
            })
        : [],
      versions: await listVersions(supabase, document.id, document.current_version_id),
      why: ready
        ? ready.model.blocks.flatMap((block) => {
            const part = ready.spec.parts.find((p) => p.id === block.partId);
            return part ? [{ partId: part.id, heading: partLabel(part, ready.spec.fields), why: part.why, onlyFor: null }] : [];
          })
        : [],
      related: ready ? await relatedDocuments(supabase, ready.spec.related) : [],
    },
  };
}

// The documents that go with this one (DR-09), by their template's slug. Titles come from the
// template files; a link is offered only once that template is approved (unreviewed templates are
// never shown to students).
async function relatedDocuments(supabase: Db, slugs: string[]): Promise<RelatedDocument[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await supabase.from("templates").select("slug, title").in("slug", slugs).eq("status", "approved");
  if (error) failed("related documents", error.code);
  const approved = new Map(data.map((t) => [t.slug, t.title]));
  return slugs.map((slug) => ({
    slug,
    title: approved.get(slug) ?? TEMPLATE_TITLES.get(slug) ?? slug,
    available: approved.has(slug),
  }));
}

const TEMPLATE_TITLES = new Map(
  TEMPLATE_FILES.flatMap((file) => {
    const parsed = templateFileSchema.safeParse(file);
    return parsed.success ? [[parsed.data.slug, parsed.data.title] as const] : [];
  }),
);

async function listVersions(supabase: Db, id: string, currentId: string | null): Promise<VersionSummary[]> {
  const { data, error } = await supabase
    .from("document_versions")
    .select("id, number, created_by, created_at")
    .eq("document_id", id)
    .order("number", { ascending: false })
    .limit(200);
  if (error) failed("versions", error.code);
  return data.map((v) => ({ id: v.id, number: v.number, by: v.created_by, createdAt: v.created_at, current: v.id === currentId }));
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
  const drawn = drawDocument({
    title: doc.title,
    hasForum: doc.forum_id !== null,
    template: template.data,
    forum: forum.data,
    content: version.data?.content,
  });
  return { document: doc, forumName: forum.data?.name ?? null, ...drawn };
}

export type { DocumentLayout };

async function forumNames(supabase: Db, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (wanted.length === 0) return new Map();
  const { data, error } = await supabase.from("forums").select("id, name").in("id", wanted);
  if (error) failed("courts", error.code);
  return new Map(data.map((f) => [f.id, f.name]));
}
