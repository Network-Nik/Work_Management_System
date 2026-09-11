"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  signIn,
  signUp,
  type AuthFormState,
} from "@/app/auth/actions";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  notice?: string;
};

const initialState: AuthFormState = {};

export function AuthForm({ mode, notice }: AuthFormProps) {
  const action: (
    previousState: AuthFormState,
    formData: FormData,
  ) => Promise<AuthFormState> = mode === "sign-in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignIn = mode === "sign-in";
  const title = isSignIn ? "Welcome back" : "Create your account";
  const submitLabel = isSignIn ? "Sign in" : "Create account";

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          href="/"
        >
          Work Management System
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isSignIn
            ? "Sign in to continue managing your work."
            : "Start organizing your projects and tasks in one place."}
        </p>

        <form action={formAction} className="mt-8 space-y-5">
          <div>
            <label
              className="block text-sm font-medium text-slate-800"
              htmlFor="email"
            >
              Email address
            </label>
            <input
              autoComplete="email"
              className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium text-slate-800"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete={isSignIn ? "current-password" : "new-password"}
              className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
              id="password"
              minLength={8}
              name="password"
              required
              type="password"
            />
            {!isSignIn && (
              <p className="mt-2 text-xs text-slate-500">
                Use at least 8 characters.
              </p>
            )}
          </div>

          {(state.error || notice) && (
            <p
              aria-live="polite"
              className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {state.error ?? notice}
            </p>
          )}
          {state.message && (
            <p
              aria-live="polite"
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {state.message}
            </p>
          )}

          <button
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Please wait…" : submitLabel}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isSignIn ? "New here?" : "Already have an account?"}{" "}
          <Link
            className="font-semibold text-indigo-600 hover:text-indigo-500"
            href={isSignIn ? "/sign-up" : "/login"}
          >
            {isSignIn ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </section>
    </main>
  );
}
