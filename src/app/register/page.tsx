import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { RegisterForm } from "@/app/register/register-form";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const supabase = await createClient();

  // 1. Authenticate user server-side
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    redirect("/login");
  }

  // 2. Check if already an approved staff member
  let isApproved = false;
  try {
    await requireApprovedStaff();
    isApproved = true;
  } catch {
    isApproved = false;
  }

  if (isApproved) {
    redirect("/dashboard");
  }

  // 3. Check for existing staff profile
  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("access_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile) {
    // Pending or rejected profile already exists
    redirect("/pending");
  }

  // 4. Check if authenticated user's email is in the approved staff allowlist
  const { data: isAllowlisted } = await supabase.rpc("is_approved_staff_email");

  // 5. If not allowlisted, render the "Access Not Available" state
  if (!isAllowlisted) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-12">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            Access Restricted
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Access Not Available
          </h1>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <p className="font-medium text-slate-900">Signed in as:</p>
            <p className="mt-0.5 break-all font-mono text-xs text-slate-700">
              {user.email}
            </p>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-600">
            Your email address is not present in the approved staff allowlist.
            Staff registration is restricted to pre-authorized personnel.
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            If you require access to this workspace, please contact your
            workspace administrator to have your email address added to the
            allowlist.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <form action={signOut} className="flex-1">
              <button
                className="flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                type="submit"
              >
                Sign out
              </button>
            </form>
            <Link
              className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
              href="/"
            >
              Return to Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // 6. If allowlisted and no profile exists, render the registration form
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
          Staff Registration
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your email has been verified against the approved staff allowlist.
          Provide your WhatsApp number to complete your profile.
        </p>

        <RegisterForm email={user.email} />

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <form action={signOut}>
            <button
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
              type="submit"
            >
              Sign out of this account
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

