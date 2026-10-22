import "server-only";
import { parseCriteria, rubricIdSchema } from "@/schemas/rubrics";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { WorkspaceLoadError } from "./workspace";

// Reads for the marking guide screens (step 4d). Reviewers and admins only: the caller's role is
// checked here, and row-level security also limits rubrics to them (migration 17).

export type RubricStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type RubricSummary = {
  id: string;
  title: string;
  courseName: string;
  topicName: string | null;
  status: RubricStatus;
  totalMarks: number;
  updatedAt: string;
};
export type RubricView = {
  id: string;
  courseId: string;
  topicId: string | null;
  title: string;
  question: string;
  criteria: { point: string; marks: number }[];
  status: RubricStatus;
  reviewedAt: string | null;
};
export type CourseTopics = { id: string; name: string; topics: { id: string; name: string }[] }[];

function failed(what: string, code: string | undefined): never {
  console.error("rubric read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

export async function listRubrics(): Promise<RubricSummary[] | null> {
  if (!(await getStaffRole())) return null;
  const supabase = await createSupabaseServerClient();
  const [rubrics, courses, topics] = await Promise.all([
    supabase.from("rubrics").select("id, title, course_id, topic_id, status, criteria, updated_at").order("updated_at", { ascending: false }).limit(500),
    supabase.from("courses").select("id, name"),
    supabase.from("topics").select("id, name"),
  ]);
  if (rubrics.error) failed("rubrics", rubrics.error.code);
  if (courses.error) failed("courses", courses.error.code);
  if (topics.error) failed("topics", topics.error.code);
  return rubrics.data.map((r) => ({
    id: r.id,
    title: r.title,
    courseName: courses.data.find((c) => c.id === r.course_id)?.name ?? "",
    topicName: topics.data.find((t) => t.id === r.topic_id)?.name ?? null,
    status: r.status,
    totalMarks: parseCriteria(r.criteria).reduce((sum, p) => sum + p.marks, 0),
    updatedAt: r.updated_at,
  }));
}

export async function getRubric(id: string): Promise<RubricView | null> {
  if (!(await getStaffRole()) || !rubricIdSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rubrics")
    .select("id, course_id, topic_id, title, question, criteria, status, reviewed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) failed("rubric", error.code);
  if (!data) return null;
  return {
    id: data.id,
    courseId: data.course_id,
    topicId: data.topic_id,
    title: data.title,
    question: data.question ?? "",
    criteria: parseCriteria(data.criteria),
    status: data.status,
    reviewedAt: data.reviewed_at,
  };
}

// Courses and their topics, for the guide form's pickers.
export async function listCourseTopics(): Promise<CourseTopics> {
  const supabase = await createSupabaseServerClient();
  const [courses, topics] = await Promise.all([
    supabase.from("courses").select("id, name, position").order("position"),
    supabase.from("topics").select("id, name, course_id, position").order("position"),
  ]);
  if (courses.error) failed("courses", courses.error.code);
  if (topics.error) failed("topics", topics.error.code);
  return courses.data.map((c) => ({
    id: c.id,
    name: c.name,
    topics: topics.data.filter((t) => t.course_id === c.id).map((t) => ({ id: t.id, name: t.name })),
  }));
}
