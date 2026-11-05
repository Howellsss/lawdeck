import { MemoryAidCard } from "@/components/lessons/MemoryAidCard";
import type { SavedAid } from "@/server/db/study";
import { RemoveSavedAid } from "./RemoveSavedAid";

// The memory aids a student saved for a topic ("My remembrance tools"), on the topic's page and in
// the Study Diary. Kept even after the lesson is updated, and removable at any time.
export function SavedAids({ aids, open = false }: { aids: SavedAid[]; open?: boolean }) {
  if (aids.length === 0) return null;
  return (
    <details open={open} className="group rounded-2xl border border-line px-4 py-3">
      <summary className="cursor-pointer text-[15px] font-medium">Your saved memory aids ({aids.length})</summary>
      <div className="mt-3 flex flex-col gap-3">
        {aids.map((aid) => (
          <MemoryAidCard key={aid.savedId} aid={aid} madeForYou={aid.madeForMe} actions={<RemoveSavedAid savedId={aid.savedId} title={aid.title} />} />
        ))}
      </div>
    </details>
  );
}
