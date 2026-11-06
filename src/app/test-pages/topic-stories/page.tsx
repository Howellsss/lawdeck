import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TopicStories } from "@/components/study/TopicStories";
import { testPagesEnabled } from "../sample";
import { sampleStories } from "../sampleStories";

// "Stories in this topic" test only (tests/voice/lessonAids.spec.ts): made-up stories, to check the
// box and its cards on phones and desktops. "Not found" unless LAWDECK_TEST_PAGES=1.
export default function TestTopicStoriesPage() {
  return (
    <Suspense fallback={null}>
      <TestTopicStories />
    </Suspense>
  );
}

async function TestTopicStories() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Wombat licences</h1>
      <TopicStories stories={sampleStories} authorityNames={new Map([["quokka-v-numbat", "Quokka v Numbat Licensing Board"]])} />
    </div>
  );
}
