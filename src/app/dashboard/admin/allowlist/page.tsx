import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AllowlistForm } from "./allowlist-form";

export default async function AllowlistPage() {
  const staff = await requireApprovedStaff();
  
  if (staff.role !== 'admin' && !staff.isOwner) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: emails } = await supabase
    .from("approved_staff_emails")
    .select("email, created_at, added_by")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/admin" className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Allowlist Management</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage who is allowed to register for an account.</p>
        </div>
      </div>

      <AllowlistForm emails={emails || []} expectedOrgId={staff.activeOrgId} />
    </div>
  );
}
