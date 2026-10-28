import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusButton } from "@/components/feedback/StatusButton";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { TAKEDOWN_DAYS } from "@/schemas/feedback";
import { listTakedowns } from "@/server/db/feedback";

export const metadata: Metadata = { title: "Takedown requests · Lawdeck" };

const DAY_MS = 24 * 60 * 60 * 1000;

// Requests to remove material (PRD FB-03): reviewers and admins only; everyone else gets "page
// not found". Each must be acted on within 7 days.
export default function TakedownsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading the requests" />}>
        <Takedowns />
      </Suspense>
    </div>
  );
}

async function Takedowns() {
  const requests = await listTakedowns();
  if (!requests) notFound();
  // Time is read once per request for the due dates.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Takedown requests</h1>
        <p className="text-muted">
          Anyone can ask for material to be removed. Act within {TAKEDOWN_DAYS} days: remove or correct the material, reply to the
          person by email, then mark the request done.
        </p>
      </div>
      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">No requests yet.</p>
      ) : (
        <ul aria-label="Takedown requests" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {requests.map((request) => {
            const due = new Date(new Date(request.createdAt).getTime() + TAKEDOWN_DAYS * DAY_MS);
            const late = request.status === "open" && due.getTime() < now;
            return (
              <li key={request.id} className="flex flex-col gap-2 px-4 py-4">
                <p className="text-sm">
                  <span className={`font-medium ${request.status === "done" ? "text-success" : "text-warning"}`}>
                    {request.status === "done" ? "Done" : late ? "Overdue" : "Open"}
                  </span>{" "}
                  · received {formatWat(request.createdAt)} ·{" "}
                  {request.status === "done" && request.doneAt ? `done ${formatWat(request.doneAt)}` : `due ${formatWat(due)}`}
                </p>
                <p className="break-words text-sm">
                  {request.name} · <a href={`mailto:${request.email}`}>{request.email}</a>
                </p>
                <p className="whitespace-pre-line break-words text-[15px]">
                  <span className="font-medium">Material: </span>
                  {request.material}
                </p>
                <p className="whitespace-pre-line break-words text-[15px]">
                  <span className="font-medium">Reason: </span>
                  {request.reason}
                </p>
                <StatusButton kind="takedown" id={request.id} closed={request.status === "done"} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
