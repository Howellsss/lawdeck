// Filters for the Study Diary timeline (founder's brief, 21): course, topic, date, case authority
// and revision status. Plain rules, tested; the page passes them in the address (?course=…).
export type DiaryFilter = {
  course?: string;
  topic?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  authority?: string;
  revision?: "due" | "upcoming" | "none";
};

type Filterable = {
  courseSlug: string;
  topicId: string;
  date: string;
  authorities: string[];
  revision: { status: "due" | "upcoming" | "none" };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Reads the filter from the page address, ignoring anything malformed.
export function readDiaryFilter(params: Record<string, string | string[] | undefined>): DiaryFilter {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value.trim().slice(0, 200) : "";
  };
  const revision = one("revision");
  return {
    course: /^[a-z0-9-]{1,60}$/.test(one("course")) ? one("course") : undefined,
    topic: /^[0-9a-f-]{36}$/.test(one("topic")) ? one("topic") : undefined,
    from: DATE.test(one("from")) ? one("from") : undefined,
    to: DATE.test(one("to")) ? one("to") : undefined,
    authority: one("authority") || undefined,
    revision: revision === "due" || revision === "upcoming" || revision === "none" ? revision : undefined,
  };
}

export function filterDiary<T extends Filterable>(entries: T[], filter: DiaryFilter): T[] {
  const authority = filter.authority?.toLowerCase();
  return entries.filter(
    (entry) =>
      (!filter.course || entry.courseSlug === filter.course) &&
      (!filter.topic || entry.topicId === filter.topic) &&
      (!filter.from || entry.date >= filter.from) &&
      (!filter.to || entry.date <= filter.to) &&
      (!authority || entry.authorities.some((name) => name.toLowerCase().includes(authority))) &&
      (!filter.revision || entry.revision.status === filter.revision),
  );
}
