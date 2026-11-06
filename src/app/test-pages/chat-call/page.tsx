import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CallDemo } from "./CallDemo";
import { testPagesEnabled } from "../sample";

// Group call screen test only (tests/voice/chat.spec.ts): made-up people, no LiveKit connection.
// "Not found" unless LAWDECK_TEST_PAGES=1.
export default function TestChatCallPage() {
  return (
    <Suspense fallback={null}>
      <TestChatCall />
    </Suspense>
  );
}

async function TestChatCall() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return <CallDemo />;
}
