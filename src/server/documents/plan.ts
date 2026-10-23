import {
  describeIssues,
  forumFileSchema,
  templateFileSchema,
  type ForumFile,
  type TemplateFile,
} from "@/schemas/drafting";

// Works out what loading the drafting files would change (step 5b), without touching the
// database: new files are added, changed ones updated (the database then puts an approved one
// back to draft), unchanged ones left alone, and files that fail the checks are reported.

export type ExistingForum = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  state: string | null;
  profile: unknown;
};
export type ExistingTemplate = {
  id: string;
  slug: string;
  title: string;
  course_id: string;
  spec: unknown;
  rule_source: string | null;
};
export type Problem = { file: string; issues: string[] };

export type ForumChange = {
  action: "add" | "update";
  file: ForumFile;
  id?: string;
};
export type TemplateChange = {
  action: "add" | "update" | "links";
  file: TemplateFile;
  courseId: string;
  id?: string;
};

export type LoadPlan = {
  forums: ForumChange[];
  templates: TemplateChange[];
  unchanged: number;
  problems: Problem[];
};

export function planLoad(input: {
  forumFiles: unknown[];
  templateFiles: unknown[];
  forums: ExistingForum[];
  templates: ExistingTemplate[];
  courses: { id: string; slug: string }[];
}): LoadPlan {
  const plan: LoadPlan = {
    forums: [],
    templates: [],
    unchanged: 0,
    problems: [],
  };

  const forumSlugs = new Set(input.forums.map((f) => f.slug));
  for (const [index, raw] of input.forumFiles.entries()) {
    const parsed = forumFileSchema.safeParse(raw);
    if (!parsed.success) {
      plan.problems.push({
        file: fileName(raw, "forum", index),
        issues: describeIssues(parsed.error),
      });
      continue;
    }
    const file = parsed.data;
    forumSlugs.add(file.slug);
    const existing = input.forums.find((f) => f.slug === file.slug);
    if (!existing) plan.forums.push({ action: "add", file });
    else if (
      existing.name !== file.name ||
      existing.kind !== file.kind ||
      existing.state !== file.state ||
      !sameJson(existing.profile, file.profile)
    )
      plan.forums.push({ action: "update", file, id: existing.id });
    else plan.unchanged += 1;
  }

  for (const [index, raw] of input.templateFiles.entries()) {
    const parsed = templateFileSchema.safeParse(raw);
    const name = fileName(raw, "template", index);
    if (!parsed.success) {
      plan.problems.push({ file: name, issues: describeIssues(parsed.error) });
      continue;
    }
    const file = parsed.data;
    const course = input.courses.find((c) => c.slug === file.course);
    const unknownForums = file.forums.filter((slug) => !forumSlugs.has(slug));
    const issues = [
      ...(course ? [] : [`course: there is no course "${file.course}".`]),
      ...unknownForums.map(
        (slug) => `forums: there is no court or registry "${slug}".`,
      ),
    ];
    if (issues.length > 0 || !course) {
      plan.problems.push({ file: name, issues });
      continue;
    }
    const existing = input.templates.find((t) => t.slug === file.slug);
    if (!existing)
      plan.templates.push({ action: "add", file, courseId: course.id });
    else if (
      existing.title !== file.title ||
      existing.course_id !== course.id ||
      existing.rule_source !== file.ruleSource ||
      !sameJson(existing.spec, file.spec)
    )
      plan.templates.push({
        action: "update",
        file,
        courseId: course.id,
        id: existing.id,
      });
    else {
      // The structure is unchanged, but its list of courts may still need tidying.
      plan.templates.push({
        action: "links",
        file,
        courseId: course.id,
        id: existing.id,
      });
      plan.unchanged += 1;
    }
  }
  return plan;
}

// Two JSON values hold the same data, whatever order their keys are in (the database may
// return object keys in a different order).
export function sameJson(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

function fileName(raw: unknown, kind: string, index: number): string {
  const slug =
    raw &&
    typeof raw === "object" &&
    "slug" in raw &&
    typeof raw.slug === "string"
      ? raw.slug.slice(0, 80)
      : null;
  return slug ?? `${kind} file ${index + 1}`;
}
