"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRightPanel } from "@/components/shell/panelContext";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { DocumentView } from "@/server/db/documents";
import type { DocModel } from "@/server/documents/render";
import { DocumentChecks } from "../DocumentChecks";
import { PagedPreview } from "../preview/PagedPreview";
import { RelatedDocuments } from "../RelatedDocuments";
import { WhyList } from "../WhyList";
import { setPreview } from "../preview/previewStore";
import { FactsEditor, type FactRequest } from "./FactsEditor";
import { InstructionBox } from "./InstructionBox";
import { PartEditor } from "./PartEditor";
import { VersionList } from "./VersionList";

type Section = "facts" | "wording" | "versions" | "why";

// A drafted document (step 5e, DR-05): its pages in the right panel, with the checks and the
// ways to change it here: by instruction, the facts, each part's wording, and its versions.
export function DocumentWorkspace({ view }: { view: DocumentView & { model: DocModel } }) {
  const panel = useRightPanel();
  const [open, setOpen] = useState<Section | null>(null);
  const [requests, setRequests] = useState<FactRequest[]>([]);
  const current = view.versions.find((v) => v.current)?.id ?? "none";

  function showPages() {
    panel.open({ title: "Pages", body: <PagedPreview /> });
  }

  // Clicking a placeholder on a page opens the matching question (or part) here.
  function jumpTo(target: { field?: string; partId: string }) {
    if (window.matchMedia("(max-width: 767px)").matches) panel.close();
    setOpen(target.field ? "facts" : "wording");
    requestAnimationFrame(() => {
      const element = document.getElementById(target.field ? `fact-${target.field}` : `part-${target.partId}`);
      element?.scrollIntoView({ block: "center" });
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.focus();
    });
  }

  // The pages always show the current version; every saved change reaches the panel at once.
  useEffect(() => {
    setPreview({ model: view.model, onPlaceholder: jumpTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.model]);

  // On wider screens the pages open beside the work area straight away.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) showPages();
    return () => panel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Show on the pages": open the pages and bring that part into view.
  function showPart(partId: string) {
    setPreview({ model: view.model, onPlaceholder: jumpTo });
    showPages();
    setTimeout(() => {
      document.querySelector(`[aria-label^="Page "] [data-part="${CSS.escape(partId)}"]`)?.scrollIntoView({ block: "center" });
    }, 150);
  }

  function showVersion(model: DocModel, number: number) {
    setPreview({ model, caption: `Version ${number}, not the current one. Restore it to use it.` });
    showPages();
  }

  return (
    <div className="flex flex-col gap-5">
      <DocumentChecks issues={view.issues} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setPreview({ model: view.model, onPlaceholder: jumpTo }); showPages(); }} className={compactSecondaryButton}>
          Show pages
        </button>
        <a href={`/api/documents/${view.id}/docx`} download className={`${compactPrimaryButton} no-underline`}>
          Download Word file
        </a>
      </div>
      <InstructionBox
        documentId={view.id}
        onAskFor={(asks) => {
          setRequests(asks);
          setOpen("facts");
        }}
      />
      <Collapsible title="Facts" id="facts" open={open === "facts"} onToggle={(o) => setOpen(o ? "facts" : null)}>
        <FactsEditor key={current} documentId={view.id} fields={view.fields} facts={view.facts} requests={requests} />
      </Collapsible>
      <Collapsible title="Wording" id="wording" open={open === "wording"} onToggle={(o) => setOpen(o ? "wording" : null)}>
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {view.parts.map((part, i) => (
            <PartEditor key={`${current}-${part.id}`} documentId={view.id} part={part} label={part.heading ?? `Part ${i + 1}`} />
          ))}
        </ul>
      </Collapsible>
      <Collapsible title={`Versions (${view.versions.length})`} id="versions" open={open === "versions"} onToggle={(o) => setOpen(o ? "versions" : null)}>
        <VersionList documentId={view.id} versions={view.versions} onShow={showVersion} />
      </Collapsible>
      <Collapsible title="Why is it arranged this way?" id="why" open={open === "why"} onToggle={(o) => setOpen(o ? "why" : null)}>
        <WhyList entries={view.why} onShow={showPart} />
      </Collapsible>
      <RelatedDocuments documentId={view.id} related={view.related} />
    </div>
  );
}

function Collapsible({ title, id, open, onToggle, children }: { title: string; id: string; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => onToggle(!open)}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line px-4 text-left text-lg font-medium"
        >
          {title}
          <span aria-hidden>{open ? "−" : "+"}</span>
        </button>
      </h2>
      <div id={`${id}-body`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
