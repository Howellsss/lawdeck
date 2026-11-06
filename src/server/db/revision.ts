import "server-only";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { StudyCheckpoint } from "./study";
import type { Loaded } from "./workspace";
import { DAILY_REVISION_CAP, revisionLeftToday, weakestFirst } from "@/lib/revision";
import { lagosDate, lagosDayStart } from "@/lib/studyDates";

export { whenStudied } from "@/lib/studyDates";

// "Before you move on" (docs/specs/remembrance.md, Phase 1d): the recall questions now due for
// revision, from the student's own schedule. Questions only, never their answers.
export const REVISION_ROUND = 10;

export type DueQuestion = StudyCheckpoint & { topicId: string; topicName: string };

export type DueRevision = {
  questions: DueQuestion[];
  totalDue: number;
  // Revision answers already given today (Lagos), and whether today's limit is reached.
  answeredToday: number;
  dailyCapReached: boolean;
  // The most recent study before today, for "Yesterday, you studied …".
  lastStudied: { topicName: string; date: string } | null;
};

export async function getDueRevision(at?: Date): Promise<Loaded<DueRevision>> {
  if (!(await getCurrentAccount())) return { status: "signed-out" };
  // Read the clock only after the request is known (Next.js would otherwise freeze it at build time).
  const now = at ?? new Date();
  const db = await createSupabaseServerClient();
  const today = lagosDate(now);
  const [due, doneToday] = await Promise.all([
    db
      .from("review_items")
      .select("checkpoint_id, topic_id, due_at, ease, lapses, last_outcome")
      .lte("due_at", now.toISOString())
      .order("due_at")
      .limit(500),
    db.from("recall_attempts").select("id", { count: "exact", head: true }).eq("context", "revision").gte("created_at", lagosDayStart(today)),
  ]);
  if (due.error || doneToday.error) throw new Error("revision read failed");
  // Phase 4: the weakest points first, and no more than the day's limit.
  const answeredToday = doneToday.count ?? 0;
  const round = Math.min(REVISION_ROUND, revisionLeftToday(answeredToday));
  const pick = round > 0 ? weakestFirst(due.data).slice(0, round * 2) : [];
  const [checkpoints, topics, last] = await Promise.all([
    pick.length
      ? db.from("lesson_checkpoints").select("id, placement, after_section, kind, prompt, choices, key_point").in("id", pick.map((d) => d.checkpoint_id))
      : Promise.resolve({ data: [] as never[] }),
    pick.length ? db.from("topics").select("id, name").in("id", [...new Set(pick.map((d) => d.topic_id))]) : Promise.resolve({ data: [] as never[] }),
    db.from("study_sessions").select("topic_id, study_date").lt("study_date", today).order("study_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const topicName = new Map(((topics.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));
  const byId = new Map(((checkpoints.data ?? []) as { id: string; placement: "reading" | "test"; after_section: number; kind: StudyCheckpoint["kind"]; prompt: string; choices: unknown; key_point: string }[]).map((c) => [c.id, c]));
  // A question whose lesson was withdrawn is no longer readable and is left out.
  const questions: DueQuestion[] = pick
    .map((d) => ({ d, c: byId.get(d.checkpoint_id) }))
    .filter((x): x is { d: (typeof pick)[number]; c: NonNullable<ReturnType<typeof byId.get>> } => Boolean(x.c))
    .slice(0, round)
    .map(({ d, c }) => ({
      id: c.id,
      placement: c.placement,
      afterSection: c.after_section,
      kind: c.kind,
      prompt: c.prompt,
      choices: Array.isArray(c.choices) ? c.choices.filter((x): x is string => typeof x === "string") : null,
      keyPoint: c.key_point,
      topicId: d.topic_id,
      topicName: topicName.get(d.topic_id) ?? "A topic",
    }));
  let lastStudied: DueRevision["lastStudied"] = null;
  if (last.data) {
    const lastTopic = await db.from("topics").select("name").eq("id", last.data.topic_id).maybeSingle();
    lastStudied = { topicName: lastTopic.data?.name ?? "a topic", date: last.data.study_date };
  }
  return {
    status: "ok",
    data: { questions, totalDue: due.data.length, answeredToday, dailyCapReached: answeredToday >= DAILY_REVISION_CAP && due.data.length > 0, lastStudied },
  };
}
