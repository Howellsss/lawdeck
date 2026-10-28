import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { testPagesEnabled } from "../sample";
import { VoiceHarness } from "./VoiceHarness";

// Voice-mode test only (tests/voice): an empty chat with voice mode on, whose answers and audio
// the test supplies. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
export default function TestVoicePage() {
  return (
    <Suspense fallback={null}>
      <TestVoice />
    </Suspense>
  );
}

async function TestVoice() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return <VoiceHarness />;
}
