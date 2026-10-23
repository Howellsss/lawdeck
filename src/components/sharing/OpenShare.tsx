import type { ReactNode } from "react";
import { StateMessage } from "@/components/ui/StateMessage";
import { openShare, type OpenedShare } from "@/server/db/sharing";

// Opens a share link for a page under /shared/<token>: visitors are asked to sign in, and a
// wrong or turned-off link says so. Otherwise it shows the page for the opened share.
export async function OpenShare({
  token,
  returnTo,
  children,
}: {
  token: string;
  returnTo: string;
  children: (share: OpenedShare) => ReactNode | Promise<ReactNode>;
}) {
  const result = await openShare(token);
  if (result.status === "signed-out")
    return (
      <StateMessage
        title="Sign in to see shared work"
        action={{ label: "Sign in", href: `/sign-in?next=${encodeURIComponent(returnTo)}` }}
      >
        A Lawdeck student shared this with you. Sign in, or make a free account, to read it.
      </StateMessage>
    );
  if (!result.data)
    return (
      <StateMessage title="This link isn’t working" action={{ label: "Go to Lawdeck", href: "/" }}>
        It may have been turned off by the person who shared it, or copied wrongly. Ask them for a new link.
      </StateMessage>
    );
  return await children(result.data);
}
