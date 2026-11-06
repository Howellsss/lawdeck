import "server-only";
import { currentVersion } from "@/lib/lessonVersions";
import { needsReading, type SectionTick } from "@/lib/readInFull";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getLessonForReview, type LessonForReview } from "./lessons";

// Skim, tick and approve (docs/specs/remembrance.md): one course's lessons that still need reading
// in full, one at a time, with the reviewer's ticks on the current version. Null for non-staff or
// an unknown course.
export type ReadingQueue = {
  course: { id: string; name: string };
  // Lessons in the course with text, and how many have been read in full (approved, not with course).
  total: number;
  readInFull: number;
  // Topics still to read, in course order.
  toRead: { topicId: string; name: string }[];
  current: (LessonForReview & { ticks: SectionTick[] }) | null;
};

export async function getReadingQueue(courseId: string, topicId?: string): Promise<ReadingQueue | null> {
  if (!(await getStaffRole())) return null;
  const db = await createSupabaseServerClient();
  const course = await db.from("courses").select("id, name").eq("id", courseId).maybeSingle();
  if (course.error || !course.data) return null;
  const topics = await db.from("topics").select("id, name, position").eq("course_id", courseId).order("position");
  if (topics.error) throw new Error("reading queue failed");
  const lessons = topics.data.length
    ? await db
        .from("topic_lessons")
        .select("id, topic_id, status, version, bulk_approved, replaced_by")
        .in(
          "topic_id",
          topics.data.map((t) => t.id),
        )
        .is("replaced_by", null)
    : { data: [], error: null };
  if (lessons.error) throw new Error("reading queue failed");

  const current = topics.data
    .map((topic) => ({ topic, lesson: currentVersion(lessons.data.filter((l) => l.topic_id === topic.id)) }))
    .filter((x): x is { topic: (typeof topics.data)[number]; lesson: NonNullable<typeof x.lesson> } => Boolean(x.lesson));
  const toRead = current.filter((x) => needsReading(x.lesson)).map((x) => ({ topicId: x.topic.id, name: x.topic.name }));
  const readInFull = current.filter((x) => x.lesson.status === "approved" && !x.lesson.bulk_approved).length;

  const pick = toRead.find((t) => t.topicId === topicId) ?? toRead[0];
  let open: ReadingQueue["current"] = null;
  if (pick) {
    const review = await getLessonForReview(pick.topicId);
    if (review?.lesson) {
      const ticks = await db
        .from("lesson_section_checks")
        .select("section, verdict, note")
        .eq("lesson_id", review.lesson.id)
        .eq("lesson_version", review.lesson.version);
      if (ticks.error) throw new Error("reading queue failed");
      open = { ...review, ticks: ticks.data };
    }
  }
  return { course: course.data, total: current.length, readInFull, toRead, current: open };
}
