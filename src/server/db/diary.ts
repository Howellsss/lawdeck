import "server-only";
import { lessonContentSchema } from "@/schemas/lesson";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { Loaded } from "./workspace";

// The Study Diary (docs/specs/remembrance.md, Phase 1c). Nothing is stored for the diary itself:
// every entry is assembled from the student's own study sessions, answers, revision schedule and
// notes, so it always agrees with recall while reading and with revision. Row-level security keeps
// it the student's alone.

export type RevisionStatus = "due" | "upcoming" | "none";

export type DiaryEntrySummary = {
  sessionId: string;
  date: string; // YYYY-MM-DD (Lagos)
  startedAt: string;
  topicId: string;
  topicName: string;
  courseSlug: string;
  courseName: string;
  minutes: number;
  completed: boolean;
  answered: number;
  correct: number;
  revision: { status: RevisionStatus; dueAt: string | null };
  authorities: string[];
};

export type DiaryOverview = {
  entries: DiaryEntrySummary[];
  totals: { topics: number; completed: number; minutes: number; answered: number; correct: number; dueNow: number };
  upcoming: { topicId: string; topicName: string; dueAt: string; count: number }[];
  courses: { slug: string; name: string }[];
};

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Everything the student studied, newest first (at most 300 sessions), with totals and what is due.
export async function getDiaryOverview(): Promise<Loaded<DiaryOverview>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  const db = await createSupabaseServerClient();
  const sessions = await db
    .from("study_sessions")
    .select("id, topic_id, lesson_id, study_date, started_at, active_seconds, completed_at")
    .order("started_at", { ascending: false })
    .limit(300);
  if (sessions.error) throw new Error("diary read failed");
  const topicIds = [...new Set(sessions.data.map((s) => s.topic_id))];
  const lessonIds = [...new Set(sessions.data.map((s) => s.lesson_id).filter((id): id is string => Boolean(id)))];
  const [topics, attempts, reviews, authorities, courses] = await Promise.all([
    topicIds.length ? db.from("topics").select("id, name, course_id").in("id", topicIds) : empty<{ id: string; name: string; course_id: string }>(),
    db.from("recall_attempts").select("session_id, outcome").limit(5000),
    db.from("review_items").select("topic_id, due_at").order("due_at"),
    lessonIds.length ? db.from("lesson_authorities").select("lesson_id, name").in("lesson_id", lessonIds) : empty<{ lesson_id: string; name: string }>(),
    db.from("courses").select("id, slug, name, position").order("position"),
  ]);
  const now = Date.now();
  const topicName = new Map((topics.data ?? []).map((t) => [t.id, t]));
  const courseOf = new Map((courses.data ?? []).map((c) => [c.id, c]));

  const entries: DiaryEntrySummary[] = sessions.data.map((session) => {
    const topic = topicName.get(session.topic_id);
    const course = topic ? courseOf.get(topic.course_id) : undefined;
    const mine = (attempts.data ?? []).filter((a) => a.session_id === session.id);
    return {
      sessionId: session.id,
      date: session.study_date,
      startedAt: session.started_at,
      topicId: session.topic_id,
      topicName: topic?.name ?? "A topic",
      courseSlug: course?.slug ?? "",
      courseName: course?.name ?? "",
      minutes: Math.round(session.active_seconds / 60),
      completed: Boolean(session.completed_at),
      answered: mine.length,
      correct: mine.filter((a) => a.outcome === "correct").length,
      revision: revisionFor(session.topic_id, reviews.data ?? [], now),
      authorities: (authorities.data ?? []).filter((a) => a.lesson_id === session.lesson_id).map((a) => a.name),
    };
  });

  const allAttempts = attempts.data ?? [];
  const byTopic = new Map<string, { dueAt: string; count: number }>();
  for (const item of reviews.data ?? []) {
    if (new Date(item.due_at).getTime() <= now) continue;
    const seen = byTopic.get(item.topic_id);
    byTopic.set(item.topic_id, { dueAt: seen?.dueAt ?? item.due_at, count: (seen?.count ?? 0) + 1 });
  }
  return {
    status: "ok",
    data: {
      entries,
      totals: {
        topics: topicIds.length,
        completed: new Set(sessions.data.filter((s) => s.completed_at).map((s) => s.topic_id)).size,
        minutes: Math.round(sessions.data.reduce((sum, s) => sum + s.active_seconds, 0) / 60),
        answered: allAttempts.length,
        correct: allAttempts.filter((a) => a.outcome === "correct").length,
        dueNow: (reviews.data ?? []).filter((r) => new Date(r.due_at).getTime() <= now).length,
      },
      upcoming: [...byTopic.entries()]
        .map(([topicId, v]) => ({ topicId, topicName: topicName.get(topicId)?.name ?? "A topic", ...v }))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, 8),
      courses: (courses.data ?? []).map((c) => ({ slug: c.slug, name: c.name })),
    },
  };
}

function revisionFor(topicId: string, reviews: { topic_id: string; due_at: string }[], now: number): DiaryEntrySummary["revision"] {
  const mine = reviews.filter((r) => r.topic_id === topicId);
  if (mine.length === 0) return { status: "none", dueAt: null };
  if (mine.some((r) => new Date(r.due_at).getTime() <= now)) return { status: "due", dueAt: null };
  return { status: "upcoming", dueAt: mine[0].due_at };
}

function empty<T>() {
  return Promise.resolve({ data: [] as T[], error: null });
}

export type DiaryEntry = {
  summary: DiaryEntrySummary;
  subtopics: string[];
  keyPoints: string[];
  authorities: { key: string; kind: "case" | "statute"; name: string; citation: string | null; principle: string; source: string | null }[];
  attempts: { prompt: string; keyPoint: string; outcome: "correct" | "partly" | "incorrect" | "skipped"; context: string; at: string }[];
  revisit: string[];
  upcomingReviews: { keyPoint: string; dueAt: string }[];
  note: string;
};

// One diary entry in full (founder's brief, 20 A–F).
export async function getDiaryEntry(sessionId: string): Promise<Loaded<DiaryEntry | null>> {
  const overview = await getDiaryOverview();
  if (overview.status === "signed-out") return overview;
  const summary = overview.data.entries.find((e) => e.sessionId === sessionId);
  if (!summary) return { status: "ok", data: null };
  const db: Db = await createSupabaseServerClient();
  const session = await db.from("study_sessions").select("lesson_id").eq("id", sessionId).single();
  const lessonId = session.data?.lesson_id ?? null;
  const [lesson, checkpoints, authorities, attempts, reviews, note] = await Promise.all([
    lessonId ? db.from("topic_lessons").select("content").eq("id", lessonId).maybeSingle() : Promise.resolve({ data: null }),
    lessonId ? db.from("lesson_checkpoints").select("id, key_point").eq("lesson_id", lessonId) : empty<{ id: string; key_point: string }>(),
    lessonId ? db.from("lesson_authorities").select("key, kind, name, citation, principle, sources").eq("lesson_id", lessonId).order("name") : empty<never>(),
    db.from("recall_attempts").select("prompt, key_point, outcome, context, created_at").eq("session_id", sessionId).order("created_at"),
    db.from("review_items").select("checkpoint_id, due_at, last_outcome").eq("topic_id", summary.topicId).order("due_at"),
    db.from("diary_notes").select("body").eq("topic_id", summary.topicId).maybeSingle(),
  ]);
  const content = lesson.data ? lessonContentSchema.safeParse(lesson.data.content) : null;
  const sources = content?.success ? content.data.sources : [];
  const keyOf = new Map((checkpoints.data ?? []).map((c) => [c.id, c.key_point]));
  const tried = attempts.data ?? [];
  return {
    status: "ok",
    data: {
      summary,
      subtopics: content?.success ? content.data.sections.map((s) => s.heading) : [],
      keyPoints: [...new Set((checkpoints.data ?? []).map((c) => c.key_point))],
      authorities: ((authorities.data ?? []) as { key: string; kind: "case" | "statute"; name: string; citation: string | null; principle: string; sources: unknown }[]).map((a) => {
        const labels = Array.isArray(a.sources) ? (a.sources as number[]) : [];
        const first = sources.find((s) => labels.includes(s.label));
        return {
          key: a.key,
          kind: a.kind,
          name: a.name,
          citation: a.citation,
          principle: a.principle,
          source: first ? [first.title, first.pages].filter(Boolean).join(" · ") : null,
        };
      }),
      attempts: tried.map((a) => ({ prompt: a.prompt, keyPoint: a.key_point, outcome: a.outcome, context: a.context, at: a.created_at })),
      revisit: [...new Set(tried.filter((a) => a.outcome !== "correct").map((a) => a.key_point))],
      upcomingReviews: (reviews.data ?? [])
        .map((r) => ({ keyPoint: keyOf.get(r.checkpoint_id) ?? "", dueAt: r.due_at }))
        .filter((r) => r.keyPoint)
        .slice(0, 20),
      note: note.data?.body ?? "",
    },
  };
}
