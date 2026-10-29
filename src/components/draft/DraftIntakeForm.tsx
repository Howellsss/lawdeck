"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { Spinner } from "@/components/ui/Spinner";
import type { IntakeView } from "@/server/db/documents";
import { startDraft } from "@/server/drafting/actions";
import { IntakeField } from "./IntakeField";

// The short intake for one document (DR-03, DR-04): which court or registry, then the facts.
// Lawdeck drafts from the approved template; missing facts stay as visible placeholders.
export function DraftIntakeForm({ intake, returnTo }: { intake: IntakeView; returnTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const chooseForum = intake.forums.length > 1;

  // Sent by hand, not as a form action: React clears a form after its action runs, which wiped
  // every answer whenever a draft could not be made (founder, 2026-10-29: "does not work after
  // adding all the information"). The answers now stay, with the reason beside the button.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(undefined);
    const facts: Record<string, string[]> = {};
    for (const field of intake.fields) facts[field.id] = form.getAll(field.id).map(String);
    const forumId = chooseForum ? String(form.get("forum") ?? "") || null : (intake.forums[0]?.id ?? null);
    // Said plainly next to the button: the browser's own warning would appear at the top, out of sight.
    if (intake.forums.length > 0 && !forumId) {
      setBusy(false);
      setMessage("Choose the court or registry at the top of the form, then press Draft the document again.");
      return;
    }
    let result: Awaited<ReturnType<typeof startDraft>>;
    try {
      result = await startDraft({ templateId: intake.id, forumId, facts });
    } catch {
      // The connection dropped or the server stopped (for example a very long draft).
      setBusy(false);
      setMessage("Lawdeck could not finish the draft. Your answers are still here: press Draft the document to try again.");
      return;
    }
    if (result.ok) {
      router.push(`/documents/${result.id}`);
      return;
    }
    setBusy(false);
    setNeedsSignIn(Boolean(result.signIn));
    setMessage(result.message);
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-5">
      {chooseForum ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Court or registry</legend>
          <p className="text-sm text-muted">The heading, form and layout follow the court or registry you choose.</p>
          {intake.forums.map((forum) => (
            <label key={forum.id} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="forum"
                value={forum.id}
                defaultChecked={forum.id === (intake.defaultForumId ?? intake.forums[0]?.id)}
              />
              {forum.name}
            </label>
          ))}
        </fieldset>
      ) : (
        // Some documents (a tenancy agreement) belong to no court or registry, so nothing shows.
        intake.forums[0] && <p className="text-sm text-muted">Court or registry: {intake.forums[0].name}</p>
      )}

      {intake.fields.map((field) => (
        <IntakeField key={field.id} field={field} values={intake.defaults[field.id]} />
      ))}

      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
          {needsSignIn && (
            <>
              {" "}
              <Link href={`/sign-in?next=${encodeURIComponent(returnTo)}`}>Sign in</Link>
            </>
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? (
            <span className="flex items-center gap-2">
              <Spinner />
              {"Drafting…"}
            </span>
          ) : "Draft the document"}
        </button>
        {busy && (
          <span role="status" className="text-sm text-muted">
            {intake.aiParts > 0 ? "Writing the narrative parts. This can take up to 30 seconds." : "Preparing the document."}
          </span>
        )}
      </div>
      <p className="text-sm text-muted">
        The structure and standard wording come from a reviewed template; Lawdeck only writes the narrative parts from your facts and
        never invents names, dates or sums. Names and addresses are never sent to the AI.
        {intake.aiParts > 0 ? " Each draft counts as one of your questions this month." : ""}
      </p>
    </form>
  );
}
