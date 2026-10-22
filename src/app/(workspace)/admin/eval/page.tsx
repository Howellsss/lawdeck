import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { getStaffRole } from "@/server/auth/roles";
import { listEvalRuns } from "@/server/db/evals";

export const metadata: Metadata = { title: "Answer tests · Lawdeck" };

// The answer quality tests (step 3e): each run puts the test cases through each model.
export default function EvalRunsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-normal text-greeting">Answer tests</h1>
        <p className="text-muted">
          Each test puts the same Civil Litigation questions and pushback cases to each AI model. Rate every answer, then
          compare the models.
        </p>
      </div>
      <Suspense fallback={<LoadingRows label="Loading the tests" />}>
        <Runs />
      </Suspense>
    </div>
  );
}

// Reviewers and admins only; everyone else gets "page not found".
async function Runs() {
  if (!(await getStaffRole())) notFound();
  const runs = await listEvalRuns();
  if (runs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
        No tests have been run yet. An admin starts one from GitHub (Actions → “Answer test”).
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
      {runs.map((run) => (
        <li key={run.id} className="flex flex-col gap-1 px-4 py-4">
          <Link href={`/admin/eval/${run.id}`} className="font-medium">
            Test of {formatWat(run.startedAt)}
          </Link>
          <p className="text-sm text-muted">
            {run.caseCount} cases · {run.models.join(", ")} · instructions {run.promptVersion} ·{" "}
            <span className={run.status === "failed" ? "text-warning" : ""}>
              {run.status === "running" ? "still running" : run.status === "failed" ? "stopped early" : "finished"}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
