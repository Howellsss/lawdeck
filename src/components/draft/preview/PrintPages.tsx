"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { DocModel } from "@/server/documents/render";
import { PAPER_MM } from "@/server/documents/layout";
import { PageSheet, useMeasuredPages } from "./pages";

// The document's pages at real size, for "Save as PDF" (PRD EX-02). The browser prints exactly
// these pages, so the PDF matches the on-screen pages page for page. With autoPrint, the print
// dialog opens once the pages are laid out; the student chooses "Save as PDF" there.
export function PrintPages({ model, backHref, autoPrint = false }: { model: DocModel; backHref?: string; autoPrint?: boolean }) {
  const { items, heights, pages, layout, measurer } = useMeasuredPages(model);
  const printed = useRef(false);
  const paper = PAPER_MM[model.profile.paper];
  const ready = pages.length > 0;

  useEffect(() => {
    if (!autoPrint || !ready || printed.current) return;
    printed.current = true;
    // Let the fonts settle before the dialog takes its copy of the page.
    void document.fonts.ready.then(() => window.print());
  }, [autoPrint, ready]);

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-paper px-4 py-6 print:block print:bg-white print:p-0">
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      <div className="flex w-full max-w-3xl flex-wrap items-center gap-3 print:hidden">
        {backHref && (
          <Link href={backHref} className="text-sm">
            Back to the document
          </Link>
        )}
        <button type="button" onClick={() => window.print()} className={`${compactPrimaryButton} ml-auto`}>
          Print or save as PDF
        </button>
        <p className="w-full text-sm text-muted">
          In the print window, choose <strong>Save as PDF</strong> as the printer. On a phone, use Share or Print, then Save as PDF.
        </p>
      </div>
      {measurer}
      <div
        className="flex flex-col items-center gap-4 print:block"
        data-page-count={ready ? pages.length : undefined}
        aria-label={`${model.title}, ${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
      >
        {pages.map((indexes, number) => (
          <PageSheet key={number} number={number + 1} indexes={indexes} items={items} heights={heights ?? undefined} layout={layout} profile={model.profile} scale={1} />
        ))}
      </div>
    </div>
  );
}
