import type { LessonForReview } from "@/server/db/lessons";
import { REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { GenerateLessonButton } from "./GenerateLessonButton";
import { LessonDecision } from "./LessonDecision";
import { MemoryAidCard, type AidView } from "./MemoryAidCard";
import { RemovePartButton } from "./RemovePartButton";

type Extras = NonNullable<LessonForReview["extras"]>;
type Part = { heading: string; text: string };

// Admin → Lessons, one topic: its memory aids and stories (Phase 2), reviewed as one set, with
// "Remove" on anything wrong. Shown in full, answers included, for the reviewer.
export function ExtrasReview({ topicId, extras, authorityNames }: { topicId: string; extras: Extras | null; authorityNames: Map<string, string> }) {
  return (
    <section aria-labelledby="extras" className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="extras" className="font-serif text-2xl font-normal">
          Memory aids and stories
        </h2>
        {extras && (
          <p className={`text-sm ${extras.status === "approved" ? "text-success" : "text-muted"}`}>
            {REVIEW_STATUS_LABELS[extras.status]}
            {extras.bulkApproved ? " with its course (not yet read in full)" : ""} · {extras.aids.length} memory aids · {extras.stories.length} stories
            {extras.model ? ` · written by ${extras.model}` : ""}
          </p>
        )}
      </div>
      <GenerateLessonButton topicId={topicId} hasLesson={Boolean(extras)} kind="extras" />
      {!extras ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">
          None yet. Lawdeck writes them from this lesson and its library passages; they never change the lesson.
        </p>
      ) : (
        <>
          <LessonDecision lessonId={extras.id} status={extras.status} note={extras.reviewNote} bulkApproved={extras.bulkApproved} target="extras" />
          {extras.aids.map((aid) => (
            <div key={aid.id} className="flex flex-col gap-1">
              <p className="text-xs text-muted">After section {aid.after_section + 1}</p>
              <MemoryAidCard
                aid={{ ...aid, items: (aid.items as AidView["items"]) ?? [] }}
                actions={<RemovePartButton kind="aid" id={aid.id} label={`memory aid: ${aid.title}`} />}
              />
            </div>
          ))}
          {extras.stories.map((story) => {
            const choices = Array.isArray(story.choices) ? (story.choices as string[]) : [];
            return (
              <section key={story.id} aria-label={`Story: ${story.title}`} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">
                    After section {story.after_section + 1} ·{" "}
                    {story.kind === "everyday" ? "Everyday story · illustration, not a real case" : `Case story · ${authorityNames.get(story.authority_key ?? "") ?? "authority"}`}
                  </p>
                  <RemovePartButton kind="story" id={story.id} label={`story: ${story.title}`} />
                </div>
                <h3 className="font-serif text-xl font-normal">{story.title}</h3>
                {((story.parts as Part[]) ?? []).map((part, i) => (
                  <div key={i} className="flex flex-col gap-0.5 text-[15px]">
                    <span className="text-sm font-medium">{part.heading}</span>
                    <p>{part.text}</p>
                  </div>
                ))}
                <p className="text-[15px]">
                  <span className="font-medium">Takeaway: </span>
                  {story.takeaway}
                </p>
                {story.question && (
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{story.question}</span>
                    <ol className="list-[upper-alpha] pl-5">
                      {choices.map((choice, i) => (
                        <li key={i} className={i === story.correct_choice ? "font-medium text-success" : ""}>
                          {choice}
                        </li>
                      ))}
                    </ol>
                    {story.explanation && <span className="text-muted">{story.explanation}</span>}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}
