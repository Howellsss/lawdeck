import "server-only";
import { lessonContentSchema, type LessonContent } from "@/schemas/lesson";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { Database } from "./types";

type ReviewStatus = Database["public"]["Tables"]["topic_lessons"]["Row"]["status"];
export type Checkpoint = Database["public"]["Tables"]["lesson_checkpoints"]["Row"];
export type Authority = Database["public"]["Tables"]["lesson_authorities"]["Row"];
export type MemoryAid = Database["public"]["Tables"]["lesson_memory_aids"]["Row"];
export type Story = Database["public"]["Tables"]["lesson_stories"]["Row"];
type ExtrasState = { status: ReviewStatus; bulkApproved: boolean };

export type LessonOverview = {
  courses: {
    id: string;
    name: string;
    topics: {
      id: string;
      name: string;
      lesson: { status: ReviewStatus; version: number; updatedAt: string; bulkApproved: boolean } | null;
      // The lesson's memory aids and stories (Phase 2), when written.
      extras: ExtrasState | null;
    }[];
  }[];
};

// Admin → Lessons: every course's topics with their lesson's state. Null for non-staff.
export async function listLessonOverview(): Promise<LessonOverview | null> {
  if (!(await getStaffRole())) return null;
  const db = await createSupabaseServerClient();
  const [courses, topics, lessons, extras] = await Promise.all([
    db.from("courses").select("id, name, position").order("position"),
    db.from("topics").select("id, name, course_id, position").order("position"),
    db.from("topic_lessons").select("id, topic_id, status, version, updated_at, bulk_approved"),
    db.from("lesson_extras").select("lesson_id, status, bulk_approved"),
  ]);
  if (courses.error || topics.error || lessons.error || extras.error) {
    console.error("lesson overview failed", { code: courses.error?.code ?? topics.error?.code ?? lessons.error?.code ?? extras.error?.code });
    throw new Error("lesson overview failed");
  }
  return {
    courses: courses.data.map((course) => ({
      id: course.id,
      name: course.name,
      topics: topics.data
        .filter((topic) => topic.course_id === course.id)
        .map((topic) => {
          const lesson = lessons.data.find((l) => l.topic_id === topic.id);
          const set = lesson ? extras.data.find((e) => e.lesson_id === lesson.id) : undefined;
          return {
            id: topic.id,
            name: topic.name,
            lesson: lesson ? { status: lesson.status, version: lesson.version, updatedAt: lesson.updated_at, bulkApproved: lesson.bulk_approved } : null,
            extras: set ? { status: set.status, bulkApproved: set.bulk_approved } : null,
          };
        }),
    })),
  };
}

export type LessonForReview = {
  topic: { id: string; name: string };
  course: { id: string; name: string };
  lesson: {
    id: string;
    title: string;
    status: ReviewStatus;
    version: number;
    reviewNote: string | null;
    bulkApproved: boolean;
    updatedAt: string;
    model: string | null;
    content: LessonContent | null;
  } | null;
  checkpoints: Checkpoint[];
  authorities: Authority[];
  extras: (ExtrasState & { id: string; reviewNote: string | null; model: string | null; aids: MemoryAid[]; stories: Story[] }) | null;
};

// One topic's lesson with its questions and authority cards, for a reviewer. Null for non-staff or
// an unknown topic.
export async function getLessonForReview(topicId: string): Promise<LessonForReview | null> {
  if (!(await getStaffRole())) return null;
  const db = await createSupabaseServerClient();
  const topic = await db.from("topics").select("id, name, course_id").eq("id", topicId).maybeSingle();
  if (topic.error || !topic.data) return null;
  const [course, lesson] = await Promise.all([
    db.from("courses").select("id, name").eq("id", topic.data.course_id).single(),
    db.from("topic_lessons").select("*").eq("topic_id", topicId).maybeSingle(),
  ]);
  if (course.error) return null;
  if (!lesson.data) {
    return { topic: { id: topic.data.id, name: topic.data.name }, course: course.data, lesson: null, checkpoints: [], authorities: [], extras: null };
  }
  const [checkpoints, authorities] = await Promise.all([
    db.from("lesson_checkpoints").select("*").eq("lesson_id", lesson.data.id).order("position"),
    db.from("lesson_authorities").select("*").eq("lesson_id", lesson.data.id).order("name"),
  ]);
  const content = lessonContentSchema.safeParse(lesson.data.content);
  return {
    topic: { id: topic.data.id, name: topic.data.name },
    course: course.data,
    lesson: {
      id: lesson.data.id,
      title: lesson.data.title,
      status: lesson.data.status,
      version: lesson.data.version,
      reviewNote: lesson.data.review_note,
      bulkApproved: lesson.data.bulk_approved,
      updatedAt: lesson.data.updated_at,
      model: lesson.data.model,
      content: content.success ? content.data : null,
    },
    checkpoints: checkpoints.data ?? [],
    authorities: authorities.data ?? [],
    extras: await extrasForReview(db, lesson.data.id),
  };
}

async function extrasForReview(db: Awaited<ReturnType<typeof createSupabaseServerClient>>, lessonId: string): Promise<LessonForReview["extras"]> {
  const set = await db.from("lesson_extras").select("id, status, bulk_approved, review_note, model").eq("lesson_id", lessonId).maybeSingle();
  if (set.error || !set.data) return null;
  const [aids, stories] = await Promise.all([
    db.from("lesson_memory_aids").select("*").eq("extras_id", set.data.id).order("position"),
    db.from("lesson_stories").select("*").eq("extras_id", set.data.id).order("position"),
  ]);
  return {
    id: set.data.id,
    status: set.data.status,
    bulkApproved: set.data.bulk_approved,
    reviewNote: set.data.review_note,
    model: set.data.model,
    aids: aids.data ?? [],
    stories: stories.data ?? [],
  };
}
