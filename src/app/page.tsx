import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : null;

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-12">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 sm:text-sm sm:tracking-[0.2em]">
          Work Management System
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Make work feel manageable.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
          Keep projects, tasks, and your team&apos;s priorities together in one
          focused workspace.
        </p>

        {email ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-medium text-emerald-950">You&apos;re signed in.</p>
            <p className="mt-1 text-sm text-emerald-800">{email}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                className="flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                href="/register"
              >
                Staff Portal / Registration
              </Link>
              <form action={signOut}>
                <button
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-500 sm:min-w-40"
              href="/sign-up"
            >
              Create an account
            </Link>
            <Link
              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 sm:min-w-40"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
