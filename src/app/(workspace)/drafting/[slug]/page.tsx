import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DraftIntakeForm } from "@/components/draft/DraftIntakeForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { StateMessage } from "@/components/ui/StateMessage";
import { getIntake } from "@/server/db/documents";

export const metadata: Metadata = { title: "Draft a document · Lawdeck" };

// One reviewed document's intake (DR-03, DR-04): court or registry, then the facts.
export default function DraftIntakePage({ params }: PageProps<"/drafting/[slug]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/drafting" className="text-sm">
        Drafting catalogue
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the questions" />}>
        <Intake params={params} />
      </Suspense>
    </div>
  );
}

async function Intake({ params }: Pick<PageProps<"/drafting/[slug]">, "params">) {
  const { slug } = await params;
  const result = await getIntake(slug);
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
