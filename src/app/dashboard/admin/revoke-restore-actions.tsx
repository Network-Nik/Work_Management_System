"use client";

import { useTransition, useState } from "react";
import { revokeStaff, restoreStaff } from "./actions";

export function RevokeButton({ userId, expectedOrgId }: { userId: string, expectedOrgId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = () => {
    if (!confirm("Are you sure you want to revoke this user's access?\n\nThey will immediately lose access to this company. Their historical work and records will remain. Their account is not deleted. Access can be restored later.")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await revokeStaff(expectedOrgId, userId);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRevoke}
        disabled={isPending}
        className="px-3 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-medium rounded transition-colors disabled:opacity-50"
      >
        {isPending ? "Revoking..." : "Revoke Access"}
      </button>
      {error && <span className="text-[10px] text-rose-400 max-w-[150px] text-right leading-tight">{error}</span>}
    </div>
  );
}

export function RestoreButton({ userId, expectedOrgId }: { userId: string, expectedOrgId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRestore = () => {
    if (!confirm("Restore access for this user? They will regain their approved status.")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await restoreStaff(expectedOrgId, userId);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRestore}
        disabled={isPending}
        className="px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium rounded transition-colors disabled:opacity-50"
      >
        {isPending ? "Restoring..." : "Restore Access"}
      </button>
      {error && <span className="text-[10px] text-rose-400 max-w-[150px] text-right leading-tight">{error}</span>}
    </div>
  );
}
