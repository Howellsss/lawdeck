import "server-only";
import { lessonContentSchema, type LessonContent } from "@/schemas/lesson";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { Loaded } from "./workspace";

// A recall question as the student's browser receives it: never the answer, the explanation or
// which choice is right, so the answer cannot be seen before the student tries (founder's brief, 17).
export type StudyCheckpoint = {
  id: string;
  placement: "reading" | "test";
  afterSection: number;
  kind: "mcq" | "short" | "open" | "authority" | "statute" | "principle" | "sequence";
  prompt: string;
  choices: string[] | null;
  keyPoint: string;
};

export type StudyAuthority = {
  key: string;
  kind: "case" | "statute";
  name: string;
  citation: string | null;
  court: string | null;
  facts: string | null;
  factsFromLibrary: boolean;
  issue: string | null;
  decision: string | null;
  principle: string;
  sources: number[];
};

export type StudyLesson = {
  topic: { id: string; name: string };
  course: { slug: string; name: string };
  lesson: { id: string; version: number; title: string; content: LessonContent; bulkApproved: boolean } | null;
  checkpoints: StudyCheckpoint[];
  authorities: StudyAuthority[];
};

// A topic's approved lesson for the signed-in student. The database returns only approved lessons
// and only to students with access; anything else reads as "not ready yet".
export async function getStudyLesson(topicId: string): Promise<Loaded<StudyLesson | null>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const db = await createSupabaseServerClient();
  const topic = await db.from("topics").select("id, name, course_id").eq("id", topicId).maybeSingle();
  if (topic.error || !topic.data) return { status: "ok", data: null };
  const [course, lesson] = await Promise.all([
    db.from("courses").select("slug, name").eq("id", topic.data.course_id).single(),
    db.from("topic_lessons").select("id, version, title, content, bulk_approved").eq("topic_id", topicId).eq("status", "approved").maybeSingle(),
  ]);
  if (course.error) return { status: "ok", data: null };
  const base = { topic: { id: topic.data.id, name: topic.data.name }, course: course.data };
  const content = lesson.data ? lessonContentSchema.safeParse(lesson.data.content) : null;
  if (!lesson.data || !content?.success) return { status: "ok", data: { ...base, lesson: null, checkpoints: [], authorities: [] } };

  const [checkpoints, authorities] = await Promise.all([
    db.from("lesson_checkpoints").select("id, placement, after_section, kind, prompt, choices, key_point").eq("lesson_id", lesson.data.id).order("position"),
    db.from("lesson_authorities").select("key, kind, name, citation, court, facts, facts_from_library, issue, decision, principle, sources").eq("lesson_id", lesson.data.id),
  ]);
  return {
    status: "ok",
    data: {
      ...base,
      lesson: { id: lesson.data.id, version: lesson.data.version, title: lesson.data.title, content: content.data, bulkApproved: lesson.data.bulk_approved },
      checkpoints: (checkpoints.data ?? []).map((c) => ({
        id: c.id,
        placement: c.placement,
        afterSection: c.after_section,
        kind: c.kind,
        prompt: c.prompt,
        choices: Array.isArray(c.choices) ? c.choices.filter((x): x is string => typeof x === "string") : null,
        keyPoint: c.key_point,
      })),
      authorities: (authorities.data ?? []).map((a) => ({
        key: a.key,
        kind: a.kind,
        name: a.name,
        citation: a.citation,
        court: a.court,
        facts: a.facts_from_library ? a.facts : null,
        factsFromLibrary: a.facts_from_library,
        issue: a.issue,
        decision: a.decision,
        principle: a.principle,
        sources: Array.isArray(a.sources) ? a.sources.filter((x): x is number => typeof x === "number") : [],
      })),
    },
  };
}
