import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";
import { planLoad, type Problem } from "./plan";

type Db = SupabaseClient<Database>;

export type LoadReport = {
  added: number;
  updated: number;
  unchanged: number;
  problems: Problem[];
};

// Loads the drafting data files into the database as the signed-in reviewer (row-level security
// allows reviewers and admins only). New and changed files arrive as drafts; approval is a
// separate, deliberate step.
export async function loadDraftingFiles(
  db: Db,
  forumFiles: unknown[],
  templateFiles: unknown[],
): Promise<LoadReport> {
  const [forums, templates, courses] = await Promise.all([
    db.from("forums").select("id, slug, name, kind, state, profile"),
    db
      .from("templates")
      .select("id, slug, title, course_id, spec, rule_source"),
    db.from("courses").select("id, slug"),
  ]);
  if (forums.error || templates.error || courses.error) {
    console.error("drafting load failed", {
      step: "read",
      code: forums.error?.code ?? templates.error?.code ?? courses.error?.code,
    });
    return {
      added: 0,
      updated: 0,
      unchanged: 0,
      problems: [
        {
          file: "all files",
          issues: [
            "Lawdeck could not read the current templates. Please try again.",
          ],
        },
      ],
    };
  }

  const plan = planLoad({
    forumFiles,
    templateFiles,
    forums: forums.data,
    templates: templates.data,
    courses: courses.data,
  });
  const report: LoadReport = {
    added: 0,
    updated: 0,
    unchanged: plan.unchanged,
    problems: [...plan.problems],
  };
  const notSaved = (file: string, step: string, code: string | undefined) => {
    console.error("drafting load failed", { step, code: code ?? "no_row" });
    report.problems.push({ file, issues: ["Not saved. Please try again."] });
  };

  const forumIds = new Map(forums.data.map((f) => [f.slug, f.id]));
  for (const change of plan.forums) {
    const row = {
      name: change.file.name,
      kind: change.file.kind,
      state: change.file.state,
      profile: change.file.profile,
    };
    if (change.action === "add") {
      const { data, error } = await db
        .from("forums")
        .insert({ slug: change.file.slug, ...row })
        .select("id")
        .single();
      if (error) notSaved(change.file.slug, "forum add", error.code);
      else {
        forumIds.set(change.file.slug, data.id);
        report.added += 1;
      }
    } else {
      const { data, error } = await db
        .from("forums")
        .update(row)
        .eq("id", change.id!)
        .select("id");
      if (error || !data?.length)
        notSaved(change.file.slug, "forum update", error?.code);
      else report.updated += 1;
    }
  }

  for (const change of plan.templates) {
    const row = {
      title: change.file.title,
      course_id: change.courseId,
      spec: change.file.spec,
      rule_source: change.file.ruleSource,
    };
    let id = change.id;
    if (change.action === "add") {
      const { data, error } = await db
        .from("templates")
        .insert({ slug: change.file.slug, ...row })
        .select("id")
        .single();
      if (error) {
        notSaved(change.file.slug, "template add", error.code);
        continue;
      }
      id = data.id;
      report.added += 1;
    } else if (change.action === "update") {
      const { data, error } = await db
        .from("templates")
        .update(row)
        .eq("id", id!)
        .select("id");
      if (error || !data?.length) {
        notSaved(change.file.slug, "template update", error?.code);
        continue;
      }
      report.updated += 1;
    }
    if (
      !(await syncForums(
        db,
        id!,
        change.file.forums
          .map((slug) => forumIds.get(slug))
          .filter((v) => v !== undefined),
      ))
    )
      notSaved(change.file.slug, "template forums", undefined);
  }
  return report;
}

// Makes the template's list of courts and registries match its file.
async function syncForums(
  db: Db,
  templateId: string,
  wanted: string[],
): Promise<boolean> {
  const { data, error } = await db
    .from("template_forums")
    .select("forum_id")
    .eq("template_id", templateId);
  if (error) return false;
  const have = new Set(data.map((link) => link.forum_id));
  const extra = [...have].filter((forumId) => !wanted.includes(forumId));
  const missing = wanted.filter((forumId) => !have.has(forumId));
  if (extra.length > 0) {
    const removed = await db
      .from("template_forums")
      .delete()
      .eq("template_id", templateId)
      .in("forum_id", extra);
    if (removed.error) return false;
  }
  if (missing.length > 0) {
    const added = await db.from("template_forums").insert(
      missing.map((forumId) => ({
        template_id: templateId,
        forum_id: forumId,
      })),
    );
    if (added.error) return false;
  }
  return true;
}
