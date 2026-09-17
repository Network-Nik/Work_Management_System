import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";

export default async function PendingPage() {
  const supabase = await createClient();

  // 1. Authenticate user server-side
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 2. If already an approved staff member, send to dashboard
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

  // 3. Fetch staff profile
  const { data: profile } = await supabase
    .from("staff_profiles")
    .select(
      "email, whatsapp_number, whatsapp_status, access_status, created_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // 4. If no profile exists yet, redirect to registration
  if (!profile) {
    redirect("/register");
  }

  // 5. Determine if user is fully rejected (all memberships rejected)
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("access_status")
    .eq("user_id", user.id);

  const isRejected = memberships && memberships.length > 0 && memberships.every(m => m.access_status === "rejected");

  if (isRejected) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-12">
        <section className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            Access Rejected
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Registration Declined
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your request for workspace staff access was reviewed and declined by
            an administrator.
          </p>

          <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-sm">
            <div className="flex justify-between border-b border-rose-100 pb-2">
              <span className="text-slate-500">Account:</span>
              <span className="font-mono text-xs text-slate-800">
                {profile.email}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Access Status:</span>
              <span className="font-semibold text-rose-700">Rejected</span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            You do not have permission to access workspace tools or the
            dashboard. If you believe this is in error, contact your system
            administrator directly.
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

  // 6. Handle pending state
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between">
          <Link
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            href="/"
          >
            Work Management System
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Pending Approval
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Registration Received
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your staff registration has been received and is awaiting administrator
          approval.
        </p>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900">
          <p className="font-semibold text-amber-950">
            Access Restricted Until Approved
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900/90">
            You cannot access the workspace dashboard or tasks until an
            administrator reviews and approves your account.
          </p>
        </div>

        <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm">
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Email:</span>
            <span className="font-medium text-slate-900">{profile.email}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">WhatsApp:</span>
            <span className="font-mono text-xs text-slate-900">
              {profile.whatsapp_number ?? "Not provided"}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Account Access:</span>
            <span className="font-medium text-amber-700">Pending Review</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">WhatsApp Status:</span>
            <span className="font-medium text-slate-700 capitalize">
              {profile.whatsapp_status}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            What happens next?
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            An administrator will verify your information against organizational
            records. When your profile is approved, you will be able to access
            the workspace.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
            href="/pending"
          >
            Check Status
          </Link>
          <form action={signOut} className="flex-1">
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

