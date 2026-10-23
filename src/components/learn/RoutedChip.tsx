import Link from "next/link";

// "Treated as: Learn" on chats that Auto mode routed (PRD WS-03), with a way to draft instead.
export function RoutedChip() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-full border border-line px-3 py-1 text-muted">Treated as: Learn</span>
      <Link href="/drafting">Switch to Draft</Link>
    </div>
  );
}
