import type { CheckIssue } from "@/server/documents/checks";

// The automatic checks (DR-06): what to look at before using the document. They only flag.
export function DocumentChecks({ issues }: { issues: CheckIssue[] }) {
  if (issues.length === 0) {
    return (
      <p role="status" className="rounded-xl border border-success px-4 py-3 text-sm text-success">
        The automatic checks found nothing to fix. Read the whole document before you use it.
      </p>
    );
  }
  return (
    <section aria-labelledby="checks-heading" className="flex flex-col gap-2 rounded-xl border border-warning px-4 py-3 text-sm">
      <h2 id="checks-heading" className="font-medium text-warning">
        {issues.length === 1 ? "1 thing to check" : `${issues.length} things to check`}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {issues.map((issue, index) => (
          <li key={index}>{issue.message}</li>
        ))}
      </ul>
    </section>
  );
}
