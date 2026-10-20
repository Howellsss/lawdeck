import type { Metadata } from "next";
import { StateMessage } from "@/components/ui/StateMessage";

export const metadata: Metadata = { title: "Sign in · Lawdeck" };

export default function SignInPage() {
  return (
    <StateMessage title="Sign-in is coming next" action={{ label: "Back to home", href: "/" }}>
      Accounts arrive in the next build step (1b): email and password first, then Google.
    </StateMessage>
  );
}
