import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserDetailView } from "@/components/admin/UserDetailView";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { userIdSchema } from "@/schemas/adminUsers";
import { getUserDetail } from "@/server/db/adminUsers";

export const metadata: Metadata = { title: "User · Lawdeck" };

// One person's account, plan, payment and usage counts (migration 34). Admins only; everyone else
// gets "page not found". Counts only: never their chats, documents or uploads themselves.
export default function UserPage(props: PageProps<"/admin/users/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<LoadingRows label="Loading this person" />}>
        <User {...props} />
      </Suspense>
    </div>
  );
}

async function User({ params }: Pick<PageProps<"/admin/users/[id]">, "params">) {
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();
  const detail = await getUserDetail(id);
  if (!detail || detail === "missing") notFound();
  // Time is read once per request for "3 minutes ago".
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now());
  return (
    <>
      <Link href="/admin/users" className="text-sm">
        All users
      </Link>
      <UserDetailView id={id} detail={detail} now={now} />
    </>
  );
}
