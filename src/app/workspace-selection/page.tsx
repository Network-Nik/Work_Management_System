import { requireStaffProfile } from "@/lib/auth/require-approved-staff";
import { WorkspaceSelector } from "./workspace-selector";

export default async function WorkspaceSelectionPage() {
  const profile = await requireStaffProfile();

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100">Select Workspace</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Choose an organization to continue to your dashboard.
          </p>
        </div>

        <WorkspaceSelector memberships={profile.memberships} />
      </div>
    </div>
  );
}

