import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VerificationRow } from "@/components/chat/VerificationRow";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { formatWat } from "@/lib/dates";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export const metadata: Metadata = { title: "Chat checks · Lawdeck" };

// Admin → Chat checks (docs/specs/chat.md): verification requests for campus chat. Admins only;
// everyone else gets "page not found".
export default function ChatChecksPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Suspense fallback={<LoadingRows label="Loading requests" />}>
        <Checks />
      </Suspense>
    </div>
  );
}

async function Checks() {
  if ((await getStaffRole()) !== "admin") notFound();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("chat_verification_queue");
  if (error) throw new Error("chat checks failed");
  const rows = data.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    kind: r.kind,
    campus: r.campus,
    idNumber: r.id_number,
    hasDocument: r.has_document,
    status: r.status,
    note: r.note,
    when: formatWat(r.decided_at ?? r.created_at),
  }));
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Chat checks</h1>
        <p className="text-muted">
          Only verified students can use campus chat. Open each ID, check the name and number match the account, then approve or reject. The ID is deleted as soon as you decide.
        </p>
      </div>
      <section aria-labelledby="pending" className="flex flex-col gap-2">
        <h2 id="pending" className="text-lg font-medium">
          Waiting for a decision ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">No requests waiting.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {pending.map((r) => (
              <VerificationRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>
      {decided.length > 0 && (
        <section aria-labelledby="decided" className="flex flex-col gap-2">
          <h2 id="decided" className="text-lg font-medium">
            Decided ({decided.length})
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {decided.map((r) => (
              <VerificationRow key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
