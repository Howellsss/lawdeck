// Shown to students while chat is still being tested by staff (Phase 2).
export function ChatClosed() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">Campus chat</h1>
      <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
        Campus chat is coming soon: a place to talk with Law School students on every campus. Choose your campus on your Account page so you are ready.
      </p>
    </div>
  );
}
