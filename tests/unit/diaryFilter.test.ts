import { describe, expect, it } from "vitest";
import { filterDiary, readDiaryFilter } from "@/lib/diaryFilter";

const topicA = "11111111-1111-4111-8111-111111111111";
const entries = [
  { id: 1, courseSlug: "civil-litigation", topicId: topicA, date: "2026-11-05", authorities: ["Wombat v Quokka"], revision: { status: "due" as const } },
  { id: 2, courseSlug: "civil-litigation", topicId: topicA, date: "2026-11-04", authorities: [], revision: { status: "upcoming" as const } },
  { id: 3, courseSlug: "criminal-litigation", topicId: "22222222-2222-4222-8222-222222222222", date: "2026-11-02", authorities: ["Kangaroo v Emu"], revision: { status: "none" as const } },
];

describe("filtering the Study Diary", () => {
  it("filters by course, topic, dates, authority and revision status", () => {
    expect(filterDiary(entries, { course: "civil-litigation" }).map((e) => e.id)).toEqual([1, 2]);
    expect(filterDiary(entries, { topic: topicA, from: "2026-11-05" }).map((e) => e.id)).toEqual([1]);
    expect(filterDiary(entries, { to: "2026-11-03" }).map((e) => e.id)).toEqual([3]);
    expect(filterDiary(entries, { authority: "kangaroo" }).map((e) => e.id)).toEqual([3]);
    expect(filterDiary(entries, { revision: "due" }).map((e) => e.id)).toEqual([1]);
    expect(filterDiary(entries, {})).toHaveLength(3);
  });

  it("reads filters from the address and ignores malformed ones", () => {
    expect(readDiaryFilter({ course: "civil-litigation", from: "2026-11-01", revision: "due", topic: topicA })).toEqual({
      course: "civil-litigation", topic: topicA, from: "2026-11-01", to: undefined, authority: undefined, revision: "due",
    });
    expect(readDiaryFilter({ course: "<script>", from: "yesterday", revision: "soon", topic: "x" })).toEqual({
      course: undefined, topic: undefined, from: undefined, to: undefined, authority: undefined, revision: undefined,
    });
  });
});
