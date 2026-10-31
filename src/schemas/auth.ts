import { z } from "@/lib/zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/passwordRules";
import { NAME_MAX } from "@/schemas/profile";

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
// The name Lawdeck greets the student by (founder, 2026-10-31: a student who signed up by email
// was greeted without her name). Only the greeting and the admin list use it; never sent to the AI.
export const signUpNameSchema = z
  .string({ error: "Enter your name." })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, { error: "Enter your name." }).max(NAME_MAX, { error: `Use ${NAME_MAX} characters or fewer.` }));

export const signUpSchema = z.object({ name: signUpNameSchema, email: emailSchema, password: newPasswordSchema });
export const emailOnlySchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: newPasswordSchema });

// Link types Supabase puts in its emails. Anything else is rejected.
export const emailLinkTypeSchema = z.enum(["signup", "email", "recovery", "email_change", "invite", "magiclink"]);
