import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatGate } from "@/components/chat/ChatGate";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { getCurrentAccount } from "@/server/auth/session";
import { chatAllowed, homeGroupKey } from "@/server/chat/data";

export const metadata: Metadata = { title: "Campus chat · Lawdeck" };

// Campus chat (docs/specs/chat.md) opens on the student's own campus group, else All campuses.
export default function ChatHome() {
  return (
    <Suspense fallback={<LoadingRows label="Opening chat" />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="campus chat" returnTo="/chat" />;
  if (!(await chatAllowed())) return <ChatGate />;
  redirect(`/chat/${await homeGroupKey()}`);
}
