"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButton } from "@/components/ui/buttons";
import { joinChat } from "@/server/chat/actions";

// Community rules, accepted once before the first post (PRD v2.1 CH-10).
export function ChatRules() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const agree = async () => {
    setBusy(true);
    const result = await joinChat();
    setBusy(false);
    if (!result.ok) return setError(result.message);
    router.refresh();
  };
  return (
    <section aria-labelledby="chat-rules" className="m-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 lg:mx-6">
      <h2 id="chat-rules" className="font-serif text-2xl font-normal">
        Before you post
      </h2>
      <p className="text-[15px] text-muted">Campus chat is for Law School students and aspirants on every campus. Anyone in chat can read every group.</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
        <li>Be respectful. No insults, harassment or hate.</li>
        <li>No vulgar or curse words: a message containing one is not sent.</li>
        <li>No exam leaks, cheating or sharing other people&rsquo;s work as your own.</li>
        <li>No phone numbers, email addresses or WhatsApp and social links: a message containing one is not sent.</li>
        <li>Messages are students&rsquo; own words, not checked by Lawdeck. Report anything that breaks these rules.</li>
      </ul>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" onClick={() => void agree()} disabled={busy} className={primaryButton}>
          {busy ? "Joining…" : "I agree, join chat"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-warning">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
