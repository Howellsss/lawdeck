import { StateMessage } from "./StateMessage";

// Shown on pages that need an account, with a link back to the same page after sign-in.
export function SignInPrompt({ what, returnTo, level = 2 }: { what: string; returnTo: string; level?: 1 | 2 }) {
  return (
    <StateMessage
      level={level}
      title={`Sign in to see your ${what}`}
      action={{ label: "Sign in", href: `/sign-in?next=${encodeURIComponent(returnTo)}` }}
    >
      Your {what} are private to your account.
    </StateMessage>
  );
}
