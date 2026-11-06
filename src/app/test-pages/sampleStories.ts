import type { StudyStory } from "@/server/db/study";

// Made-up stories for the test-only pages (made-up law about made-up places, not legal content).
const id = (n: number) => `00000000-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`;

export const sampleStories: StudyStory[] = [
  {
    id: id(3),
    afterSection: 0,
    kind: "everyday",
    title: "Chidi's poultry licence",
    authorityKey: null,
    parts: [{ heading: "What happened", text: "Chidi in Ibadan paid ₦50,000 but no officer came to inspect his made-up farm." }],
    takeaway: "No inspection, no valid licence.",
    question: "Is Chidi's made-up licence valid?",
    choices: ["Yes", "No"],
  },
  {
    id: id(4),
    afterSection: 0,
    kind: "case",
    title: "The farm that was never inspected",
    authorityKey: "quokka-v-numbat",
    parts: [{ heading: "The decision", text: "A made-up court held the made-up licence void." }],
    takeaway: "Inspection is a condition of validity.",
    question: null,
    choices: null,
  },
];
