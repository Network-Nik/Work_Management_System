"use client";

import { useState } from "react";
import { switchWorkspaceAction } from "./workspace-actions";
import { type ApprovedStaff } from "@/lib/auth/require-approved-staff";

type WorkspaceSwitcherProps = {
  staff: ApprovedStaff;
};

export function WorkspaceSwitcher({ staff }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Find the active membership details
  const activeMembership = staff.memberships.find(m => m.organization_id === staff.activeOrgId);
  if (!activeMembership) return null;

  const orgName = activeMembership.organizations?.name || "Unknown";
  const orgInitials = orgName.substring(0, 2).toUpperCase();

  const handleSwitch = async (orgId: string) => {
    if (orgId === staff.activeOrgId) {
      setIsOpen(false);
      return;
    }
    
    setLoadingId(orgId);
    const res = await switchWorkspaceAction(orgId);
    if (!res.error) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } else {
      setLoadingId(null);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative p-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded shrink-0 bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
            <span className="text-xs font-semibold text-zinc-300">{orgInitials}</span>
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate leading-tight">{orgName}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Workspace</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-4 right-4 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden py-1 z-50">
            <div className="px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Switch Workspace</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {staff.memberships.map((m) => {
                const isActive = m.organization_id === staff.activeOrgId;
                const isLoading = loadingId === m.organization_id;
                
                return (
                  <button
                    key={m.organization_id}
                    onClick={() => handleSwitch(m.organization_id)}
                    disabled={loadingId !== null}
                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-zinc-800 transition-colors disabled:opacity-50 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded shrink-0 bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                        <span className="text-[10px] font-semibold text-zinc-400 group-hover:text-zinc-300">
                          {(m.organizations?.name || "??").substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className={`text-sm truncate ${isActive ? "text-indigo-400 font-medium" : "text-zinc-300"}`}>
                        {m.organizations?.name || "Unknown"}
                      </span>
                    </div>
                    {isLoading ? (
                      <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0 ml-3" />
                    ) : isActive ? (
                      <svg className="w-4 h-4 text-indigo-400 shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
