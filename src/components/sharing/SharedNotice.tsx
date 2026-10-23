import { formatWat } from "@/lib/dates";

// Says that the page is someone's shared work, and that it can only be read.
export function SharedNotice({ isOwner, sharedAt }: { isOwner: boolean; sharedAt: string }) {
  return (
    <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
      {isOwner
        ? "This is your own view-only link. People you send it to see this page after signing in."
        : `Shared with you by a Lawdeck student on ${formatWat(sharedAt)}. View only: you can’t change it.`}
    </p>
  );
}
