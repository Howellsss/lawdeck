import "server-only";
import {
  describeIssues,
  draftingIdSchema,
  forumProfileSchema,
  templateSpecSchema,
  type ForumProfile,
  type TemplateSpec,
} from "@/schemas/drafting";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { WorkspaceLoadError } from "./workspace";

// Reads for the template screens (step 5b). Reviewers and admins only: the caller's role is
// checked here, and row-level security shows students approved items only (migration 21).

export type DraftingStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type ForumSummary = {
  id: string;
  name: string;
  kind: "court" | "registry";
  state: string | null;
  status: DraftingStatus;
  profile: ForumProfile | null;
  issues: string[];
  updatedAt: string;
};
export type TemplateSummary = {
  id: string;
  title: string;
  courseName: string;
  version: number;
  status: DraftingStatus;
  forumNames: string[];
  updatedAt: string;
};
export type TemplateView = TemplateSummary & {
  slug: string;
  ruleSource: string | null;
  reviewedAt: string | null;
  spec: TemplateSpec | null;
  issues: string[];
};

function failed(what: string, code: string | undefined): never {
  console.error("drafting read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

export async function listDrafting(): Promise<{
  forums: ForumSummary[];
  templates: TemplateSummary[];
} | null> {
  if (!(await getStaffRole())) return null;
  const supabase = await createSupabaseServerClient();
  const [forums, templates, links, courses] = await Promise.all([
    supabase
      .from("forums")
      .select("id, name, kind, state, status, profile, updated_at")
      .order("name")
      .limit(500),
    supabase
      .from("templates")
      .select("id, title, course_id, version, status, updated_at")
      .order("title")
      .limit(500),
    supabase.from("template_forums").select("template_id, forum_id"),
    supabase.from("courses").select("id, name"),
  ]);
  if (forums.error) failed("forums", forums.error.code);
  if (templates.error) failed("templates", templates.error.code);
  if (links.error) failed("template forums", links.error.code);
  if (courses.error) failed("courses", courses.error.code);
  const forumName = new Map(forums.data.map((f) => [f.id, f.name]));
  return {
    forums: forums.data.map((f) => {
      const profile = forumProfileSchema.safeParse(f.profile);
      return {
        id: f.id,
        name: f.name,
        kind: f.kind,
        state: f.state,
        status: f.status,
        profile: profile.success ? profile.data : null,
        issues: profile.success ? [] : describeIssues(profile.error),
        updatedAt: f.updated_at,
      };
    }),
    templates: templates.data.map((t) => ({
      id: t.id,
      title: t.title,
      courseName: courses.data.find((c) => c.id === t.course_id)?.name ?? "",
      version: t.version,
      status: t.status,
      forumNames: links.data
        .filter((l) => l.template_id === t.id)
        .map((l) => forumName.get(l.forum_id) ?? ""),
      updatedAt: t.updated_at,
    })),
  };
}

export async function getTemplate(id: string): Promise<TemplateView | null> {
  if (!(await getStaffRole()) || !draftingIdSchema.safeParse(id).success)
    return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("templates")
    .select(
      "id, slug, title, course_id, version, status, spec, rule_source, reviewed_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) failed("template", error.code);
  if (!data) return null;
  const [links, course] = await Promise.all([
    supabase.from("template_forums").select("forum_id").eq("template_id", id),
    supabase
      .from("courses")
      .select("name")
      .eq("id", data.course_id)
      .maybeSingle(),
  ]);
  if (links.error) failed("template forums", links.error.code);
  const forums = links.data.length
    ? await supabase
        .from("forums")
        .select("name")
        .in(
          "id",
          links.data.map((l) => l.forum_id),
        )
    : { data: [], error: null };
  if (forums.error) failed("forums", forums.error.code);
  const spec = templateSpecSchema.safeParse(data.spec);
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    courseName: course.data?.name ?? "",
    version: data.version,
    status: data.status,
    forumNames: forums.data.map((f) => f.name),
    updatedAt: data.updated_at,
    ruleSource: data.rule_source,
    reviewedAt: data.reviewed_at,
    spec: spec.success ? spec.data : null,
    issues: spec.success ? [] : describeIssues(spec.error),
  };
}
