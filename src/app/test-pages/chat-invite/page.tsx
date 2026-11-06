import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatVerifyForm } from "@/components/chat/ChatVerifyForm";
import { IdTestSwitch } from "@/components/chat/IdTestSwitch";
import { InviteLinkBox } from "@/components/chat/InviteLinkBox";
import { JoinStep } from "@/components/chat/JoinStep";
import { testPagesEnabled } from "../sample";

// Invite links and the ID test switch, test only (tests/voice/chat.spec.ts): no database, so every
// button shows its "didn't work" message. "Not found" unless LAWDECK_TEST_PAGES=1.
const linkUntil = new Date(Date.now() + 5 * 86_400_000).toISOString();

export default function TestChatInvitePage() {
  return (
    <Suspense fallback={null}>
      <TestChatInvite />
    </Suspense>
  );
}

async function TestChatInvite() {
  await connection();
  if (!testPagesEnabled()) notFound();
  const campuses = [
    { key: "lagos", name: "Lagos", kind: "campus" as const },
    { key: "aspirant", name: "Aspirants", kind: "aspirant" as const },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <InviteLinkBox groupId="00000000-0000-4000-8000-000000000804" linkUntil={linkUntil} />
      <IdTestSwitch on />
      <section aria-label="Quick ID">
        <ChatVerifyForm campuses={campuses} campus="lagos" apiKey="test" quick />
      </section>
      <JoinStep code={"a".repeat(64)} step="ready" groupName="Civil Lit squad" />
    </div>
  );
}
