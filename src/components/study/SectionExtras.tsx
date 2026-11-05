import { MemoryAidCard } from "@/components/lessons/MemoryAidCard";
import type { StudyAid, StudyStory } from "@/server/db/study";
import { SaveAidButton } from "./SaveAidButton";
import { StoryCard } from "./StoryCard";

// The memory aids and stories that belong after one section of a lesson (Phase 2b): at most one
// aid per section (Lawdeck's own limit), stories closed until opened.
export function SectionExtras({
  index,
  aids,
  stories,
  authorityNames,
}: {
  index: number;
  aids: StudyAid[];
  stories: StudyStory[];
  authorityNames: Map<string, string>;
}) {
  const hereAids = aids.filter((a) => a.afterSection === index);
  const hereStories = stories.filter((s) => s.afterSection === index);
  if (hereAids.length === 0 && hereStories.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {hereAids.map((aid) => (
        <MemoryAidCard key={aid.id} aid={aid} actions={<SaveAidButton aidId={aid.id} saved={aid.saved} title={aid.title} />} />
      ))}
      {hereStories.map((story) => (
        <StoryCard key={story.id} story={story} authorityName={story.authorityKey ? (authorityNames.get(story.authorityKey) ?? null) : null} />
      ))}
    </div>
  );
}
