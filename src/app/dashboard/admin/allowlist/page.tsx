import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AllowlistPage() {
  const staff = await requireApprovedStaff();
  
  if (staff.role !== 'admin') {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/admin" className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Allowlist Management</h1>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-200 tracking-tight">Allowlist Controls</h2>
        <p className="mt-2 text-zinc-400 max-w-sm mx-auto">
          The ability to add and remove emails from the approved staff allowlist will be implemented in a future update. 
          For now, please manage the allowlist directly via the Supabase Dashboard.
        </p>
      </div>
    </div>
  );
}

