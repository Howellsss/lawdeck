"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { StudySheet } from "@/server/exports/sheet";
import { SheetView } from "./SheetView";

// The study sheet ready to print or save as PDF; the print window opens once it is shown.
export function PrintSheet({ sheet, backHref }: { sheet: StudySheet; backHref: string }) {
  const printed = useRef(false);
  useEffect(() => {
    if (printed.current) return;
    printed.current = true;
    void document.fonts.ready.then(() => window.print());
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-paper px-4 py-6 print:block print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 20mm; }"}</style>
      <div className="flex w-full max-w-3xl flex-wrap items-center gap-3 print:hidden">
        <Link href={backHref} className="text-sm">
          Back
        </Link>
        <button type="button" onClick={() => window.print()} className={`${compactPrimaryButton} ml-auto`}>
          Print or save as PDF
        </button>
        <p className="w-full text-sm text-muted">
          In the print window, choose <strong>Save as PDF</strong> as the printer. On a phone, use Share or Print, then Save as PDF.
        </p>
      </div>
      <SheetView sheet={sheet} />
    </div>
  );
}
