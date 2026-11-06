import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatBody } from "@/components/chat/ChatBody";
import { ChatClosed } from "@/components/chat/ChatClosed";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { dayLabel, watDay, watTime } from "@/lib/chatTime";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { chatAllowed, searchChat } from "@/server/chat/data";

export const metadata: Metadata = { title: "Search chat · Lawdeck" };

const querySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  tag: z
    .string()
    .regex(/^[A-Za-z0-9_]{1,40}$/)
    .transform((t) => t.toLowerCase())
    .optional(),
});

// Search every group's messages by words, or open a #hashtag (PRD v2.1 CH-05, CH-07).
export default function ChatSearchPage({ searchParams }: PageProps<"/chat/search">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Searching chat" />}>
        <Search searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Search({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const parsed = querySchema.safeParse({ q: typeof raw.q === "string" ? raw.q : undefined, tag: typeof raw.tag === "string" ? raw.tag : undefined });
  if (!parsed.success) notFound();
  const { q, tag } = parsed.data;
  if (!(await getCurrentAccount())) return <SignInPrompt level={1} what="campus chat" returnTo="/chat/search" />;
  if (!(await chatAllowed())) return <ChatClosed />;
  const results = q || tag ? await searchChat(q, tag ?? null) : [];
  return (
    <>
      <Link href="/chat" className="text-sm text-muted">
        ← Back to chat
      </Link>
      <h1 className="font-serif text-3xl font-normal text-greeting">{tag ? `#${tag}` : "Search chat"}</h1>
      <form action="/chat/search" className="flex max-w-xl gap-2">
        <label htmlFor="chat-q" className="sr-only">
          Search words
        </label>
        <input id="chat-q" name="q" type="search" defaultValue={q} placeholder="Search every group" className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[16px]" />
        <button type="submit" className="h-11 rounded-lg bg-ink px-4 text-[14px] font-medium text-on-ink">
          Search
        </button>
      </form>
      {!q && !tag ? (
        <p className="text-muted">Search messages in every group, or tap a #hashtag in a message to see everything with it.</p>
      ) : !results?.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">Nothing found. Try other words.</p>
      ) : (
        <ol aria-label="Results" className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {results.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 px-4 py-3">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
                <Link href={`/chat/${m.groupKey}`} className="font-medium">
                  #{m.groupName}
                </Link>
                <span className="font-semibold text-ink">{m.author.name}</span>
                <span>
                  {dayLabel(watDay(m.createdAt))}, {watTime(m.createdAt)}
                </span>
              </p>
              <ChatBody body={m.body} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
