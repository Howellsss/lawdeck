import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EvalCaseView } from "@/components/eval/EvalCaseView";
import { EvalSummaryTable } from "@/components/eval/EvalSummaryTable";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { blindOrder, summariseByModel } from "@/lib/evalSummary";
import { evalCaseIdSchema, evalRunIdSchema } from "@/schemas/evals";
import { getStaffRole } from "@/server/auth/roles";
import { getEvalRun } from "@/server/db/evals";

export const metadata: Metadata = { title: "Answer test · Lawdeck" };

export default function EvalRunPage(props: PageProps<"/admin/eval/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Link href="/admin/eval" className="text-sm">
        All answer tests
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the test" />}>
        <Run {...props} />
      </Suspense>
    </div>
  );
}

// Reviewers and admins only; everyone else gets "page not found".
async function Run({ params, searchParams }: PageProps<"/admin/eval/[id]">) {
  if (!(await getStaffRole())) notFound();
  const { id } = await params;
  if (!evalRunIdSchema.safeParse(id).success) notFound();
  const loaded = await getEvalRun(id);
  if (!loaded) notFound();
  const { run, answers } = loaded;

  const caseIds = [...new Set(answers.map((a) => a.caseId))].sort();
  const query = await searchParams;
  const asked = evalCaseIdSchema.safeParse(query.case);
  const current = asked.success && caseIds.includes(asked.data) ? asked.data : caseIds[0];
  const index = caseIds.indexOf(current);
  const caseAnswers = blindOrder(current ?? "", answers.filter((a) => a.caseId === current));
  const rated = (caseId: string) => answers.filter((a) => a.caseId === caseId && !a.error).every((a) => a.rating);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Test of {formatWat(run.startedAt)}</h1>
        <p className="text-sm text-muted">
          {run.caseCount} cases · instructions {run.promptVersion}
          {run.status === "running" && " · still running: refresh to see more answers"}
        </p>
      </div>

      <EvalSummaryTable summaries={summariseByModel(answers, run.models)} />

      {caseIds.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">No answers saved yet.</p>
      ) : (
        <>
          <nav aria-label="Test cases" className="flex flex-wrap gap-2 text-sm">
            {caseIds.map((caseId) => (
              <Link
                key={caseId}
                href={`/admin/eval/${run.id}?case=${caseId}`}
                aria-current={caseId === current ? "page" : undefined}
                className={`rounded-full border px-3 py-1 no-underline ${caseId === current ? "border-ink font-medium" : "border-line"} ${
                  rated(caseId) ? "text-success" : ""
                }`}
              >
                {caseId}
                {rated(caseId) && <span className="sr-only"> (rated)</span>}
              </Link>
            ))}
          </nav>
          <EvalCaseView answers={caseAnswers} />
          <div className="flex justify-between text-sm">
            {index > 0 ? <Link href={`/admin/eval/${run.id}?case=${caseIds[index - 1]}`}>Previous case</Link> : <span />}
            {index < caseIds.length - 1 && <Link href={`/admin/eval/${run.id}?case=${caseIds[index + 1]}`}>Next case</Link>}
          </div>
        </>
      )}
    </>
  );
}
