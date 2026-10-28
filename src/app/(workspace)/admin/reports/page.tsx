import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusButton } from "@/components/feedback/StatusButton";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { REPORT_CATEGORIES } from "@/schemas/feedback";
import { getStaffRole } from "@/server/auth/roles";
import { listReports } from "@/server/db/feedback";

export const metadata: Metadata = { title: "Reports · Lawdeck" };

const KIND = { answer: "Answer", document: "Document", brief: "Brief", practice_item: "Practice question" } as const;

// Problems students reported (PRD FB-01): reviewers and admins only; everyone else gets
// "page not found".
export default function ReportsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the reports" />}>
        <Reports />
      </Suspense>
    </div>
  );
}

async function Reports() {
  const [reports, role] = await Promise.all([listReports(), getStaffRole()]);
  if (!reports) notFound();
  const isAdmin = role === "admin";
  const open = reports.filter((r) => r.status === "open").length;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Reports</h1>
        <p className="text-muted">
          {open === 0 ? "No open reports." : `${open} open ${open === 1 ? "report" : "reports"}.`} Fix the library entry or template if
          the student is right, then mark the report resolved.
        </p>
      </div>
      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">No reports yet.</p>
      ) : (
        <ul aria-label="Reports" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {reports.map((report) => (
            <li key={report.id} className="flex flex-col gap-2 px-4 py-4">
              <p className="text-sm">
                <span className={`font-medium ${report.status === "open" ? "text-warning" : "text-success"}`}>
                  {report.status === "open" ? "Open" : "Resolved"}
                </span>{" "}
                · {REPORT_CATEGORIES[report.category]} · {KIND[report.kind]} · {formatWat(report.createdAt)}
              </p>
              {report.note && <p className="whitespace-pre-line break-words text-[15px]">“{report.note}”</p>}
              {report.context ? (
                <details className="text-sm">
                  <summary className="cursor-pointer">What was reported: {report.context.title}</summary>
                  <p className="mt-2 whitespace-pre-line break-words text-muted">{report.context.body}</p>
                </details>
              ) : (
                <p className="text-sm text-muted">The student has since deleted what they reported.</p>
              )}
              {report.kind === "answer" && report.context && isAdmin && (
                <Link href={`/admin/answers/${report.targetId}`} className="self-start text-sm">
                  Trace the sources behind this answer
                </Link>
              )}
              <StatusButton kind="report" id={report.id} closed={report.status === "resolved"} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
