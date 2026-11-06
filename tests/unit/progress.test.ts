import { describe, expect, it } from "vitest";
import { courseProgress, pointState, studyDays, topicProgress, weakestTopics, weeklyAccuracy, type Attempt, type Point, type TopicInfo } from "@/lib/progress";

const now = new Date("2026-11-06T10:00:00Z"); // a Friday in Lagos
const point = (topic_id: string, over: Partial<Point> = {}): Point => ({
  topic_id,
  interval_days: 3,
  ease: 2.5,
  last_outcome: "correct",
  due_at: "2026-11-10T00:00:00Z",
  ...over,
});
const attempt = (topic_id: string, outcome: Attempt["outcome"], created_at = "2026-11-05T09:00:00Z"): Attempt => ({ topic_id, outcome, created_at });
const topics: TopicInfo[] = [
  { id: "t1", name: "Wombat summons", courseSlug: "civil", courseName: "Civil Litigation" },
  { id: "t2", name: "Quokka bail", courseSlug: "criminal", courseName: "Criminal Litigation" },
  { id: "t3", name: "Numbat appeals", courseSlug: "civil", courseName: "Civil Litigation" },
  { id: "t4", name: "Never studied", courseSlug: "civil", courseName: "Civil Litigation" },
];

describe("how well each point is remembered", () => {
  it("calls a point mastered only when remembered and spaced two weeks or more", () => {
    expect(pointState(point("t1", { interval_days: 14 }))).toBe("mastered");
    expect(pointState(point("t1", { interval_days: 7 }))).toBe("learning");
    expect(pointState(point("t1", { interval_days: 30, last_outcome: "partly" }))).toBe("slipping");
  });

  it("calls a point slipping when missed last time or found hard", () => {
    expect(pointState(point("t1", { last_outcome: "incorrect" }))).toBe("slipping");
    expect(pointState(point("t1", { last_outcome: "skipped" }))).toBe("slipping");
    expect(pointState(point("t1", { interval_days: 30, ease: 1.9 }))).toBe("slipping");
    expect(pointState(point("t1", { ease: null, last_outcome: null }))).toBe("learning");
  });
});

describe("topics and courses", () => {
  const points = [
    point("t1", { interval_days: 16 }),
    point("t1", { last_outcome: "incorrect", due_at: "2026-11-05T00:00:00Z" }),
    point("t1"),
    point("t2", { last_outcome: "partly" }),
    point("t2", { last_outcome: "incorrect" }),
    point("t3", { interval_days: 35 }),
  ];
  const attempts = [attempt("t1", "correct"), attempt("t1", "incorrect"), attempt("t2", "incorrect"), attempt("t2", "partly"), attempt("t3", "correct")];
  const rows = topicProgress(points, attempts, topics, now);

  it("counts each topic's points, what is due and its accuracy, and leaves out topics never studied", () => {
    expect(rows.map((r) => r.id)).toEqual(["t1", "t2", "t3"]);
    expect(rows[0]).toMatchObject({ points: 3, mastered: 1, learning: 1, slipping: 1, dueNow: 1, answered: 2, correct: 1, accuracy: 50 });
    expect(rows[1]).toMatchObject({ slipping: 2, accuracy: 0 });
  });

  it("adds topics up by course", () => {
    const courses = courseProgress(rows);
    const civil = courses.find((c) => c.slug === "civil")!;
    expect(civil).toMatchObject({ points: 4, mastered: 2, slipping: 1, answered: 3, correct: 2, accuracy: 67 });
    expect(civil.topics.map((t) => t.name)).toEqual(["Numbat appeals", "Wombat summons"]);
  });

  it("lists the weakest topics first, and only topics with slipping points", () => {
    expect(weakestTopics(rows).map((t) => t.id)).toEqual(["t2", "t1"]);
  });
});

describe("over time", () => {
  it("gives recall accuracy for each of the last eight weeks, Monday to Sunday in Lagos", () => {
    const weeks = weeklyAccuracy(
      [
        attempt("t1", "correct", "2026-11-02T08:00:00Z"), // this week (Monday)
        attempt("t1", "incorrect", "2026-11-01T23:30:00Z"), // Monday 00:30 in Lagos: this week too
        attempt("t1", "correct", "2026-10-28T09:00:00Z"), // last week
        attempt("t1", "correct", "2026-01-01T09:00:00Z"), // too old
      ],
      now,
    );
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual({ start: "2026-11-02", answered: 2, correct: 1, accuracy: 50 });
    expect(weeks[6]).toMatchObject({ start: "2026-10-26", answered: 1, accuracy: 100 });
    expect(weeks[0]).toMatchObject({ start: "2026-09-14", answered: 0, accuracy: null });
  });

  it("marks study days and counts the run of days in a row", () => {
    const result = studyDays(["2026-11-05", "2026-11-04", "2026-11-03", "2026-11-01", "2026-09-01"], now);
    expect(result.days).toHaveLength(35);
    expect(result.days.at(-1)).toEqual({ date: "2026-11-06", studied: false });
    expect(result.studiedCount).toBe(4);
    expect(result.streak).toBe(3); // today not yet studied: the run up to yesterday still counts
    expect(studyDays(["2026-11-06", "2026-11-05"], now).streak).toBe(2);
    expect(studyDays(["2026-11-03"], now).streak).toBe(0);
  });
});
