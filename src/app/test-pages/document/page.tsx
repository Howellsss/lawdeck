import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintPages } from "@/components/draft/preview/PrintPages";
import { sampleModel, testPagesEnabled } from "../sample";

// Export test only (step 5h): a template's pages with made-up facts, exactly as "Save as PDF"
// prints them. "Not found" unless LAWDECK_TEST_PAGES=1 (never set on the live site).
export default function TestDocumentPage({ searchParams }: PageProps<"/test-pages/document">) {
  return (
    <Suspense fallback={null}>
      <TestDocument searchParams={searchParams} />
    </Suspense>
  );
}

async function TestDocument({ searchParams }: Pick<PageProps<"/test-pages/document">, "searchParams">) {
  await connection();
  if (!testPagesEnabled()) notFound();
  const { t, f } = await searchParams;
  const model = typeof t === "string" ? sampleModel(t, typeof f === "string" && f ? f : null) : null;
  if (!model) notFound();
  return <PrintPages model={model} />;
}
