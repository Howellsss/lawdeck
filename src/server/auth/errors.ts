// Plain-language messages for sign-in problems. Codes come from Supabase Auth.
// Messages never say whether an account exists, so nobody can test which emails are registered.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don’t match. Check them and try again, or reset your password.",
  email_not_confirmed: "Please confirm your email first. Open the link we sent you, or create your account again to get a new link.",
  weak_password: "Choose a stronger password: at least 10 characters, not a common word or phrase.",
  same_password: "Your new password must be different from your old one.",
  over_email_send_rate_limit: "Too many emails were sent just now. Wait a few minutes, then try again.",
  over_request_rate_limit: "Too many tries. Wait a few minutes, then try again.",
  email_address_invalid: "Enter a valid email address, like name@example.com.",
  signup_disabled: "New accounts are closed at the moment. Please try again later.",
  session_not_found: "Your reset link has expired. Ask for a new one.",
};

export const GENERIC_AUTH_ERROR = "Something went wrong while signing in. Your details were not saved. Please try again.";
export const NOT_CONFIGURED_ERROR = "Sign-in isn’t switched on for this site yet. Please check back soon.";

export function messageForAuthError(code: string | undefined): string {
  return (code && MESSAGES[code]) || GENERIC_AUTH_ERROR;
}
