import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatGate } from "@/components/chat/ChatGate";
import { ChatRules } from "@/components/chat/ChatRules";
import { JoinStep } from "@/components/chat/JoinStep";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { openInviteLink } from "@/server/chat/links";

export const metadata: Metadata = { title: "Join a study group · Lawdeck" };

const codeSchema = z.string().regex(/^[0-9a-f]{64}$/);

// A study group invite link (docs/specs/chat.md, step 4g): sign up or log in, Lawdeck access, the
// chat ID step and the community rules, in that order, then Join. The database checks every step.
export default function JoinStudyGroupPage({ params }: PageProps<"/chat/join/[code]">) {
  return (
    <Suspense fallback={<LoadingRows label="Opening the invite" />}>
      <Join params={params} />
    </Suspense>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">{title}</h1>
      <div className="text-[15px] text-muted">{children}</div>
    </div>
  );
}

async function Join({ params }: { params: Promise<{ code: string }> }) {
  const code = codeSchema.safeParse((await params).code);
  if (!code.success) return <Notice title="This invite link doesn’t work">Check you copied the whole link, or ask for a new one.</Notice>;
  const back = `/chat/join/${code.data}`;
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="the study group you were invited to" returnTo={back} />;
  const { step, groupName, groupKey } = await openInviteLink(code.data);
  if (step === "member" && groupKey) redirect(`/chat/${groupKey}`);
  if (step === "invalid") return <Notice title="This invite link has expired">It was turned off or is more than 7 days old. Ask the group&rsquo;s creator for a new one.</Notice>;
  if (step === "full") return <Notice title={`${groupName ?? "This group"} is full`}>A study group can have up to 15 people.</Notice>;
  if (step === "other_side")
    return <Notice title="This group isn’t for your account">Study groups are for Law School students with students, and aspirants with aspirants.</Notice>;
  const invited = (
    <p role="status" className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] lg:mx-auto">
      You&rsquo;re invited to join <span className="font-semibold">{groupName}</span>, a study group on Lawdeck.
    </p>
  );
  return (
    <div className="flex flex-col px-4 lg:px-8">
      {invited}
      {step === "verify" ? <ChatGate /> : step === "rules" ? <div className="mx-auto w-full max-w-3xl"><ChatRules /></div> : <JoinStep code={code.data} step={step} groupName={groupName ?? "the group"} />}
    </div>
  );
}
