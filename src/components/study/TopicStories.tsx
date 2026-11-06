import type { StudyStory } from "@/server/db/study";
import { StoryCard } from "./StoryCard";

// "Stories in this topic" (founder, 2026-11-06): every approved story of a topic in one place, so
// students know they exist without reading to the section they belong to. Folded to one line on the
// lesson (the stories also sit under their sections there); open on Revise visually. Each story
// opens in place, with its quick question.
export function TopicStories({
  stories,
  authorityNames,
  open = false,
}: {
  stories: StudyStory[];
  authorityNames: Map<string, string>;
  open?: boolean;
}) {
  if (stories.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-line" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5">
        <span className="text-[15px] font-medium">Stories in this topic ({stories.length})</span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <p className="text-sm text-muted">Read a point as a story: easier to remember, then a quick question.</p>
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} authorityName={story.authorityKey ? (authorityNames.get(story.authorityKey) ?? null) : null} />
        ))}
      </div>
    </details>
  );
}
