import { getOwnCampus, listCampuses } from "@/server/db/campuses";
import { getMyVerification } from "@/server/chat/verification";
import { ChatVerifyForm } from "./ChatVerifyForm";

// What a student sees before they can use campus chat (docs/specs/chat.md): verify first, then wait
// for an admin; once verified, chat opens when Lawdeck opens it to students.
export async function ChatGate() {
  const [verification, campuses, campus] = await Promise.all([getMyVerification(), listCampuses(), getOwnCampus()]);
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const status = verification?.status;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-normal text-greeting">Campus chat</h1>
        <p className="text-muted">A private space for verified Law School students: your own campus group and one group for every campus.</p>
      </div>
      {status === "approved" ? (
        <p role="status" className="rounded-2xl border border-success px-4 py-4 text-[15px]">
          <span className="font-medium text-success">You&rsquo;re verified.</span> Campus chat opens to students soon; you&rsquo;ll find it in the side menu.
        </p>
      ) : status === "pending" ? (
        <p role="status" className="rounded-2xl border border-line bg-surface px-4 py-4 text-[15px]">
          <span className="font-medium">We&rsquo;re checking your ID.</span> An admin will look at it soon, usually within a day. You&rsquo;ll see the result here.
        </p>
      ) : status === "revoked" ? (
        <p role="alert" className="rounded-2xl border border-warning px-4 py-4 text-[15px]">
          <span className="font-medium text-warning">You&rsquo;ve been removed from campus chat.</span> Everything else in Lawdeck still works for you.
        </p>
      ) : (
        <section aria-labelledby="verify" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
          <h2 id="verify" className="text-lg font-medium">
            Verify you&rsquo;re a Law School student
          </h2>
          {status === "rejected" && (
            <p role="alert" className="text-[15px] text-warning">
              Your last request wasn&rsquo;t approved{verification?.note ? `: ${verification.note}` : "."} Please try again.
            </p>
          )}
          <p className="text-[15px] text-muted">To keep chat safe, only verified students can join. An admin checks every request.</p>
          <ChatVerifyForm campuses={campuses} campus={campus} apiKey={apiKey} />
        </section>
      )}
    </div>
  );
}
