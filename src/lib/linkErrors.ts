// Messages shown on the sign-in screen after an email link did not work (?error=…).
const MESSAGES: Record<string, string> = {
  link: "That link has expired or was already used. Sign in below, or ask for a new link.",
  // The standard Supabase emails only finish in the browser where the student asked for them.
  google: "Google sign-in didn’t finish. Try again, or sign in with your email below.",
  browser:
    "We couldn’t finish signing you in from that link. If you were confirming your email, it is probably confirmed: try signing in below. If you were resetting your password, open the link in the same browser where you asked for it, or ask for a new link.",
};

export function linkErrorMessage(code: string | null): string | undefined {
  return code ? MESSAGES[code] : undefined;
}
