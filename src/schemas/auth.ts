import { z } from "@/lib/zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/passwordRules";

export const emailSchema = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .min(1, { error: "Enter your email address." })
  .max(254, { error: "That email address is too long." })
  .pipe(z.email({ error: "Enter a valid email address, like name@example.com." }));

export const newPasswordSchema = z
  .string({ error: "Enter a password." })
  .min(PASSWORD_MIN, { error: `Use at least ${PASSWORD_MIN} characters.` })
  .max(PASSWORD_MAX, { error: `Use ${PASSWORD_MAX} characters or fewer.` });

// For signing in we only check the password is present; Supabase decides if it is right.
const existingPasswordSchema = z
  .string({ error: "Enter your password." })
  .min(1, { error: "Enter your password." })
  .max(PASSWORD_MAX, { error: "That password is too long." });

export const signInSchema = z.object({ email: emailSchema, password: existingPasswordSchema });
export const signUpSchema = z.object({ email: emailSchema, password: newPasswordSchema });
export const emailOnlySchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: newPasswordSchema });

// Link types Supabase puts in its emails. Anything else is rejected.
export const emailLinkTypeSchema = z.enum(["signup", "email", "recovery", "email_change", "invite", "magiclink"]);
