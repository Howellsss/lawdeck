import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LiveCallDemo } from "./LiveCallDemo";
import { testPagesEnabled } from "../sample";

// Leaving a call test only (tests/voice/chat.spec.ts): the real call screen, pointed at an address
// that never answers, so Leave is tested while the call is still connecting.
// "Not found" unless LAWDECK_TEST_PAGES=1.
export default function TestChatCallLivePage() {
  return (
    <Suspense fallback={null}>
      <TestChatCallLive />
    </Suspense>
  );
}

async function TestChatCallLive() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return <LiveCallDemo />;
}
