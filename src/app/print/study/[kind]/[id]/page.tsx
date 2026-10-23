import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintSheet } from "@/components/exports/PrintSheet";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { StateMessage } from "@/components/ui/StateMessage";
import { exportRequestSchema } from "@/schemas/exports";
import { EXPORT_HOME, loadSheet } from "@/server/exports/load";

export const metadata: Metadata = { title: "Save as PDF · Lawdeck", robots: { index: false } };

// A chat (as notes), brief or practice set, ready to print or save as PDF (PRD EX-03). Outside
// the workspace so nothing else prints. Sign-in and ownership are checked as on its own page.
export default function PrintStudyPage({ params, searchParams }: PageProps<"/print/study/[kind]/[id]">) {
  return (
    <Suspense fallback={<LoadingRows label="Preparing the pages" />}>
      <PrintView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PrintView({ params, searchParams }: Pick<PageProps<"/print/study/[kind]/[id]">, "params" | "searchParams">) {
  const [{ kind, id }, query] = await Promise.all([params, searchParams]);
  const parsed = exportRequestSchema.safeParse({ kind, id, notKnown: query.notKnown === "1" });
  if (!parsed.success) notFound();
  const result = await loadSheet(parsed.data);
  const home = `${EXPORT_HOME[parsed.data.kind]}/${parsed.data.id}`;
  if (result.status === "signed-out")
    return (
      <StateMessage title="Sign in to save your work" action={{ label: "Sign in", href: `/sign-in?next=${encodeURIComponent(home)}` }}>
        Your notes, briefs and practice sets are private to your account.
      </StateMessage>
    );
  if (!result.data) notFound();
  return <PrintSheet sheet={result.data} backHref={home} />;
}
