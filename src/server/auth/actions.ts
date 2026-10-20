"use server";

import { redirect } from "next/navigation";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { safeNextPath } from "@/lib/safeNextPath";
import { emailOnlySchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/schemas/auth";
import { getSupabaseConfig } from "./config";
import { GENERIC_AUTH_ERROR, NOT_CONFIGURED_ERROR, messageForAuthError } from "./errors";
import { siteOrigin } from "./origin";
import { getCurrentAccount } from "./session";
import { createSupabaseServerClient } from "./supabase";

export type AuthFormState = {
  status: "idle" | "error" | "sent";
  message?: string;
  fieldErrors?: FieldErrors;
  // Echoed back so the form keeps what the student typed. Never a password.
  email?: string;
};

const notConfigured: AuthFormState = { status: "error", message: NOT_CONFIGURED_ERROR };

// Logs only the action and Supabase's error code: never emails or passwords (rule I-03).
function logAuthFailure(action: string, code: string | undefined) {
  console.warn("auth action failed", { action, code: code ?? "unknown" });
}

function emailFrom(formData: FormData): string {
  const value = formData.get("email");
  return typeof value === "string" ? value.slice(0, 254) : "";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = emailFrom(formData);
  const parsed = signInSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), email };
  if (!getSupabaseConfig()) return { ...notConfigured, email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    logAuthFailure("signIn", error.code);
    return { status: "error", message: messageForAuthError(error.code), email };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = emailFrom(formData);
  const parsed = signUpSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), email };
  if (!getSupabaseConfig()) return { ...notConfigured, email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/` },
  });
  if (error) {
    logAuthFailure("signUp", error.code);
    return { status: "error", message: messageForAuthError(error.code), email };
  }
  // If email confirmation is switched off in Supabase, the student is signed in straight away.
  if (data.session) redirect("/");
  // Same answer whether or not the email was already registered (no account guessing).
  return { status: "sent", email: parsed.data.email };
}

export async function resendConfirmation(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = emailFrom(formData);
  const parsed = emailOnlySchema.safeParse({ email });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), email };
  if (!getSupabaseConfig()) return { ...notConfigured, email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/` },
  });
  if (error) {
    logAuthFailure("resendConfirmation", error.code);
    return { status: "error", message: messageForAuthError(error.code), email };
  }
  return { status: "sent", email: parsed.data.email, message: "We sent the link again." };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = emailFrom(formData);
  const parsed = emailOnlySchema.safeParse({ email });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), email };
  if (!getSupabaseConfig()) return { ...notConfigured, email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    logAuthFailure("requestPasswordReset", error.code);
    if (error.code?.startsWith("over_")) return { status: "error", message: messageForAuthError(error.code), email };
    return { status: "error", message: GENERIC_AUTH_ERROR, email };
  }
  return { status: "sent", email: parsed.data.email };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  if (!getSupabaseConfig()) return notConfigured;

  // Only the person who opened the reset link (now signed in by it) may change the password.
  const account = await getCurrentAccount();
  if (!account) return { status: "error", message: messageForAuthError("session_not_found") };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logAuthFailure("updatePassword", error.code);
    return { status: "error", message: messageForAuthError(error.code) };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  if (getSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    // Ends the session on the Supabase server too, not just in this browser (rule C-03).
    const { error } = await supabase.auth.signOut();
    if (error) logAuthFailure("signOut", error.code);
  }
  redirect("/");
}
