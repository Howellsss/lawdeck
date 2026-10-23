import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportProblem } from "@/components/feedback/ReportProblem";
import { ExportButtons } from "@/components/exports/ExportButtons";
import { DeleteBriefButton } from "@/components/briefs/DeleteBriefButton";
import { AnswerText } from "@/components/learn/AnswerText";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatWat } from "@/lib/dates";
import { getBrief } from "@/server/db/briefs";

export const metadata: Metadata = { title: "Brief · Lawdeck" };

// One saved brief: its sections in order, with the library sources it came from.
export default function BriefPage({ params }: PageProps<"/briefs/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/briefs" className="text-sm">
        All briefs
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the brief" />}>
        <BriefView params={params} />
      </Suspense>
    </div>
  );
}

async function BriefView({ params }: Pick<PageProps<"/briefs/[id]">, "params">) {
  const { id } = await params;
  const result = await getBrief(id);
  if (result.status === "signed-out") return <SignInPrompt level={1} what="briefs" returnTo={`/briefs/${id}`} />;
  if (!result.data) notFound();
  const brief = result.data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">{brief.name}</h1>
        <p className="text-sm text-muted">
          {brief.kind === "case" ? "Case brief" : "Statute brief"} · {formatWat(brief.createdAt)} · from approved course material
        </p>
      </div>
      <article className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
        {brief.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="font-medium">{section.heading}</h2>
            {section.covered ? (
              <div className="flex flex-col gap-2 text-[15px] leading-relaxed">
                <AnswerText text={section.text} citable={new Set()} />
              </div>
            ) : (
              <p className="text-[15px] text-muted">{section.text}</p>
            )}
          </section>
        ))}
        {brief.sources.length > 0 && (
          <section className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-muted">
            <h2 className="font-medium text-ink">Sources</h2>
            <ul className="flex flex-col gap-1">
              {brief.sources.map((source) => (
                <li key={source.label}>
                  [S{source.label}] {[source.title, source.heading, source.pages].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <ReportProblem kind="brief" id={brief.id} />
      <ExportButtons kind="brief" id={brief.id} />
      <DeleteBriefButton id={brief.id} />
    </>
  );
}
