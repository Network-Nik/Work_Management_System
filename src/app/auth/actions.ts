"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
};

function getCredentials(formData: FormData):
  | { email: string; password: string }
  | AuthFormState {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    password.length < 8
  ) {
    return {
      error: "Enter a valid email address and a password of at least 8 characters.",
    };
  }

  return { email, password };
}

function isAuthFormState(
  value: { email: string; password: string } | AuthFormState,
): value is AuthFormState {
  return "error" in value || "message" in value;
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const credentials = getCredentials(formData);

  if (isAuthFormState(credentials)) {
    return credentials;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: "Invalid email or password. Please try again." };
  }

  redirect("/");
}

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const credentials = getCredentials(formData);

  if (isAuthFormState(credentials)) {
    return credentials;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const emailRedirectTo = new URL("/auth/callback", origin);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: { emailRedirectTo: emailRedirectTo.toString() },
  });

  if (error) {
    return { error: "We couldn't create your account. Please try again." };
  }

  if (data.session) {
    redirect("/");
  }

  return { message: "Check your email to confirm your account, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
