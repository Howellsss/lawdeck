import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { StateMessage } from "@/components/ui/StateMessage";
import { listCatalogue } from "@/server/db/documents";

export const metadata: Metadata = { title: "Drafting catalogue · Lawdeck" };

// The drafting catalogue (PRD DR-01): reviewed documents by course. Only approved templates show.
export default function DraftingPage({ searchParams }: PageProps<"/drafting">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">Drafting catalogue</h1>
      <Suspense fallback={<LoadingRows label="Loading the catalogue" />}>
        <Catalogue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Catalogue({ searchParams }: Pick<PageProps<"/drafting">, "searchParams">) {
  const query = await searchParams;
  const result = await listCatalogue();
  if (result.status === "signed-out") return <SignInToDraft returnTo="/drafting" level={2} />;
  return (
    <>
      {query.unmatched === "1" && (
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          Lawdeck couldn’t match your request to a reviewed document. Choose one below, or ask Lawdeck to explain what the document
          needs.
        </p>
      )}
      <p className="text-muted">
        Writs, motions, deeds and more, laid out as Nigerian courts and registries expect. Each document comes from a template a legal
        reviewer has approved; you answer a few questions and Lawdeck drafts it.
      </p>
      {result.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No documents have been reviewed yet. Reviewed documents will appear here.
        </p>
      ) : (
        result.data.map((course) => (
          <section key={course.slug} className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">{course.name}</h2>
            <ul aria-label={course.name} className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
              {course.templates.map((template) => (
                <li key={template.slug} className="px-4 py-3">
                  <Link href={`/drafting/${template.slug}`} className="break-words font-medium">
                    {template.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="text-sm">
        <Link href="/documents">Your documents</Link>
      </p>
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
