"use client";

import { useEffect, useState } from "react";
import { switchWorkspaceAction } from "@/app/dashboard/workspace-actions";

type WorkspaceSelectorProps = {
  memberships: Array<{
    organization_id: string;
    organizations: { name: string } | null;
  }>;
};

export function WorkspaceSelector({ memberships }: WorkspaceSelectorProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (orgId: string) => {
    try {
      setLoadingId(orgId);
      setError(null);
      const res = await switchWorkspaceAction(orgId);
      if (res.error) {
        setError(res.error);
        setLoadingId(null);
      } else {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoadingId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (memberships.length === 1) {
      const autoOrgId = memberships[0].organization_id;
      switchWorkspaceAction(autoOrgId).then((res) => {
        if (!mounted) return;
        if (res.error) {
          setError(res.error);
        } else {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/dashboard");
        }
      }).catch(() => {
        if (mounted) setError("An unexpected error occurred. Please try again.");
      });
    }
    return () => {
      mounted = false;
    };
  }, [memberships]);

  if (!memberships || memberships.length === 0) {
    return (
      <div className="text-center text-sm text-zinc-500 py-4">
        You do not belong to any approved organizations.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
          {error}
        </div>
      )}

      {memberships.map((m) => {
        const isLoading = loadingId === m.organization_id;
        const isDisabled = loadingId !== null;
        
        return (
          <button
            key={m.organization_id}
            onClick={() => handleSelect(m.organization_id)}
            disabled={isDisabled}
            className="flex items-center gap-4 w-full p-4 text-left rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
              <span className="text-sm font-medium text-zinc-300">
                {(m.organizations?.name || "??").substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                {m.organizations?.name || "Unknown Organization"}
              </h3>
            </div>
            {isLoading && (
              <div className="w-4 h-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
