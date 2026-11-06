import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getDueRevision, whenStudied } from "@/server/db/revision";

// "Before you move on…" (founder's brief, 22–24): when a student comes back and some of what they
// studied is due for revision, a short challenge is offered first. It never blocks new study.
export async function BeforeYouMoveOn({ compact = false }: { compact?: boolean }) {
  // An optional card: if revision can't be read, the page carries on without it.
  const result = await getDueRevision().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!result || result.status !== "ok" || result.data.questions.length === 0) return null;
  const { questions, totalDue, lastStudied } = result.data;
  const topics = [...new Set(questions.map((q) => q.topicName))];
  const opening = lastStudied
    ? `${whenStudied(lastStudied.date)}, you studied ${lastStudied.topicName}.`
    : `You have studied ${topics[0]}${topics.length > 1 ? ` and ${topics.length - 1} other topic${topics.length > 2 ? "s" : ""}` : ""}.`;
  return (
    <section
      aria-labelledby="before-you-move-on"
      className={`flex w-full flex-col gap-2 rounded-2xl border border-line bg-surface ${compact ? "p-4" : "p-5"}`}
    >
      <p id="before-you-move-on" className="text-xs uppercase tracking-[0.14em] text-muted">
        Before you move on…
      </p>
      <p className="font-serif text-xl">{opening} Let&rsquo;s see what you still remember.</p>
      <p className="text-sm text-muted">
        {questions.length} question{questions.length === 1 ? "" : "s"} due
        {totalDue > questions.length ? ` (${totalDue} in all; the rest come next time)` : ""} · about {Math.max(1, Math.round(questions.length * 0.5))} min
        {topics.length > 1 ? ` · ${topics.join(", ")}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link href="/revise" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-on-ink no-underline">
          Start the memory challenge
        </Link>
        <span className="text-sm text-muted">or carry on with something new; it will wait.</span>
      </div>
    </section>
  );
}
