import { ReportProblem } from "@/components/feedback/ReportProblem";

// Shown on lessons approved together with their course (founder's decision, 2026-11-05): written
// by Lawdeck from the library and checked against it, but not yet read in full by a reviewer.
export function BulkApprovedNote({ lessonId }: { lessonId: string }) {
  return (
    <aside aria-label="About this lesson" className="flex flex-col gap-2 rounded-2xl border border-line px-4 py-3 text-sm text-muted">
      <p>
        <span className="text-warning">Not yet read in full by a reviewer.</span> Lawdeck wrote this lesson from its library and checked every case
        and statute against it. If something looks wrong, tell us and a reviewer will check it.
      </p>
      <ReportProblem kind="lesson" id={lessonId} />
    </aside>
  );
}
