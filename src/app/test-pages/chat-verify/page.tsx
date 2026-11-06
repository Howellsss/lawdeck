import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatVerifyForm } from "@/components/chat/ChatVerifyForm";
import { testPagesEnabled } from "../sample";

// Chat verification test only (tests/voice/chat.spec.ts): the form students fill before joining
// chat. Sending needs an account, so here it shows the sign-in message.
// "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
const campuses = [
  { key: "abuja", name: "Abuja", kind: "campus" as const },
  { key: "lagos", name: "Lagos", kind: "campus" as const },
  { key: "aspirant", name: "Law School aspirant", kind: "aspirant" as const },
];

export default function TestChatVerifyPage() {
  return (
    <Suspense fallback={null}>
      <TestChatVerify />
    </Suspense>
  );
}

async function TestChatVerify() {
  await connection();
  if (!testPagesEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10">
      <h1 className="font-serif text-3xl font-normal text-greeting">Campus chat</h1>
      <ChatVerifyForm campuses={campuses} campus="lagos" apiKey="test" />
    </div>
  );
}
