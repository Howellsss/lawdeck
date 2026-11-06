import type { StudyDays } from "@/lib/progress";

const dayName = (date: string) =>
  new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

// The last five weeks of study days (Phase 4b): a filled square for each day the student studied.
export function StudyDaysGrid({ days }: { days: StudyDays }) {
  return (
    <section aria-labelledby="study-days" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="study-days" className="text-lg font-medium">
          Study days
        </h2>
        <p className="text-sm text-muted">
          {days.studiedCount} of the last {days.days.length} days · {days.streak} in a row
        </p>
      </div>
      <ol aria-label="Days studied" className="grid w-full max-w-[17rem] grid-cols-7 gap-1.5">
        {days.days.map((d) => (
          <li
            key={d.date}
            title={`${dayName(d.date)}: ${d.studied ? "studied" : "not studied"}`}
            aria-label={`${dayName(d.date)}: ${d.studied ? "studied" : "not studied"}`}
            className={`aspect-square rounded-[4px] ${d.studied ? "bg-ink" : "border border-line"}`}
          />
        ))}
      </ol>
    </section>
  );
}
