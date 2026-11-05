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

// Memory aids and stories (Phase 2b), when both they and the lesson are approved. A story's
// question comes without its answer, like the recall questions.
export type StudyAid = {
  id: string;
  afterSection: number;
  kind: "acronym" | "phrase" | "association" | "pattern";
  title: string;
  device: string;
  items: { key: string; meaning: string }[];
  explanation: string | null;
  saved: boolean;
};
export type StudyStory = {
  id: string;
  afterSection: number;
  kind: "everyday" | "case";
  title: string;
  authorityKey: string | null;
  parts: { heading: string; text: string }[];
  takeaway: string;
  question: string | null;
  choices: string[] | null;
};
// Every aid the student saved for this topic, including ones from earlier versions of the lesson.
export type SavedAid = Omit<StudyAid, "id" | "afterSection" | "saved"> & { savedId: string; aidId: string | null; madeForMe: boolean };

export type StudyLesson = {
  topic: { id: string; name: string };
  course: { slug: string; name: string };
  lesson: { id: string; version: number; title: string; content: LessonContent; bulkApproved: boolean } | null;
  checkpoints: StudyCheckpoint[];
  authorities: StudyAuthority[];
  aids: StudyAid[];
  stories: StudyStory[];
  savedAids: SavedAid[];
};

// A saved aid as the pages show it.
export function toSavedAid(s: { id: string; aid_id: string | null; kind: SavedAid["kind"]; title: string; device: string; items: unknown; explanation: string | null; made_for_me?: boolean }): SavedAid {
  return { savedId: s.id, aidId: s.aid_id, kind: s.kind, title: s.title, device: s.device, items: pairs(s.items), explanation: s.explanation, madeForMe: Boolean(s.made_for_me) };
}

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter((v): v is Row => typeof v === "object" && v !== null) : []);
const pairs = (value: unknown) =>
  rows(value).flatMap((v) => (typeof v.key === "string" && typeof v.meaning === "string" ? [{ key: v.key, meaning: v.meaning }] : []));
const storyParts = (value: unknown) =>
  rows(value).flatMap((v) => (typeof v.heading === "string" && typeof v.text === "string" ? [{ heading: v.heading, text: v.text }] : []));

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
  if (!lesson.data || !content?.success) {
    return { status: "ok", data: { ...base, lesson: null, checkpoints: [], authorities: [], aids: [], stories: [], savedAids: [] } };
  }

  const [checkpoints, authorities, extras, saved] = await Promise.all([
    db.from("lesson_checkpoints").select("id, placement, after_section, kind, prompt, choices, key_point").eq("lesson_id", lesson.data.id).order("position"),
    db.from("lesson_authorities").select("key, kind, name, citation, court, facts, facts_from_library, issue, decision, principle, sources").eq("lesson_id", lesson.data.id),
    // Readable only when approved (row-level security); otherwise the lesson shows without them.
    db.from("lesson_extras").select("id").eq("lesson_id", lesson.data.id).maybeSingle(),
    db.from("saved_memory_aids").select("id, aid_id, kind, title, device, items, explanation, made_for_me").eq("topic_id", topicId).order("created_at"),
  ]);
  const [aids, stories] = extras.data
    ? await Promise.all([
        db.from("lesson_memory_aids").select("id, after_section, kind, title, device, items, explanation").eq("extras_id", extras.data.id).order("position"),
        db.from("lesson_stories").select("id, after_section, kind, title, authority_key, parts, takeaway, question, choices").eq("extras_id", extras.data.id).order("position"),
      ])
    : [{ data: [] }, { data: [] }];
  const savedIds = new Set((saved.data ?? []).map((s) => s.aid_id));
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
      aids: (aids.data ?? []).map((a) => ({
        id: a.id,
        afterSection: a.after_section,
        kind: a.kind,
        title: a.title,
        device: a.device,
        items: pairs(a.items),
        explanation: a.explanation,
        saved: savedIds.has(a.id),
      })),
      stories: (stories.data ?? []).map((s) => ({
        id: s.id,
        afterSection: s.after_section,
        kind: s.kind,
        title: s.title,
        authorityKey: s.authority_key,
        parts: storyParts(s.parts),
        takeaway: s.takeaway,
        question: s.question,
        choices: Array.isArray(s.choices) ? s.choices.filter((x): x is string => typeof x === "string") : null,
      })),
      savedAids: (saved.data ?? []).map(toSavedAid),
    },
  };
}
