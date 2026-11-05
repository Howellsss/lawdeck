import Link from "next/link";
import type { DiaryFilter } from "@/lib/diaryFilter";

const field = "h-10 rounded-xl border border-line bg-paper px-3 text-[14px] text-ink";

// Filters for the timeline (founder's brief, 21). A plain form: the choice goes in the address,
// so a filtered view can be bookmarked, and it works without JavaScript.
export function DiaryFilters({
  filter,
  courses,
  topics,
}: {
  filter: DiaryFilter;
  courses: { slug: string; name: string }[];
  topics: { id: string; name: string }[];
}) {
  return (
    <form method="get" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4" aria-label="Filter the diary">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Course
          <select name="course" defaultValue={filter.course ?? ""} className={field}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Topic
          <select name="topic" defaultValue={filter.topic ?? ""} className={field}>
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Revision
          <select name="revision" defaultValue={filter.revision ?? ""} className={field}>
            <option value="">Any</option>
            <option value="due">Due now</option>
            <option value="upcoming">Coming up</option>
            <option value="none">Nothing scheduled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          From
          <input type="date" name="from" defaultValue={filter.from ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <input type="date" name="to" defaultValue={filter.to ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Case or statute
          <input type="search" name="authority" defaultValue={filter.authority ?? ""} maxLength={200} placeholder="e.g. a party's name" className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-on-ink">
          Filter
        </button>
        <Link href="/diary" className="text-sm">
          Clear filters
        </Link>
      </div>
    </form>
  );
}
