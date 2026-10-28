import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DraftIntakeForm } from "@/components/draft/DraftIntakeForm";
import { WhyList } from "@/components/draft/WhyList";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { StateMessage } from "@/components/ui/StateMessage";
import { getIntake } from "@/server/db/documents";

export const metadata: Metadata = { title: "Draft a document · Lawdeck" };

// One reviewed document's intake (DR-03, DR-04): court or registry, then the facts.
export default function DraftIntakePage({ params, searchParams }: PageProps<"/drafting/[slug]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Link href="/drafting" className="text-sm">
        Drafting catalogue
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the questions" />}>
        <Intake params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Intake({ params, searchParams }: Pick<PageProps<"/drafting/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const { from } = await searchParams;
  const result = await getIntake(slug, typeof from === "string" ? from : undefined);
  if (result.status === "signed-out") return <SignInToDraft returnTo={`/drafting/${slug}`} level={1} />;
  if (!result.data) notFound();
  const intake = result.data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">{intake.title}</h1>
        <p className="text-sm text-muted">{intake.courseName} · reviewed template</p>
      </div>
      <p className="text-muted">Answer what you can. Anything you leave out stays as a placeholder you can fill in later.</p>
      {Object.keys(intake.defaults).length > 0 && (
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          Answers from your other document are filled in. Check them before drafting.
        </p>
      )}
      <details className="flex flex-col gap-3">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Why is it arranged this way?</summary>
        <WhyList entries={intake.why} />
      </details>
      <DraftIntakeForm intake={intake} returnTo={`/drafting/${slug}`} />
    </>
  );
}

function SignInToDraft({ returnTo, level }: { returnTo: string; level: 1 | 2 }) {
  return (
    <StateMessage level={level} title="Sign in to draft documents" action={{ label: "Sign in", href: `/sign-in?next=${encodeURIComponent(returnTo)}` }}>
      Documents you draft are kept private to your account.
    </StateMessage>
  );
}
