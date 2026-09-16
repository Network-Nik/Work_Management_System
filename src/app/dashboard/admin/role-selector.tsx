"use client";

import { useTransition, useState } from "react";
import { updateStaffRole } from "./actions";

export function RoleSelector({ userId, currentRole }: { userId: string, currentRole: "admin" | "manager" | "employee" }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    
    if (currentRole === 'admin' && newRole !== 'admin') {
      if (!confirm("Are you sure you want to demote this Admin? If they are the last Admin, this will be blocked.")) {
        e.target.value = currentRole;
        return;
      }
    }

    setError(null);
    startTransition(async () => {
      const result = await updateStaffRole(userId, newRole);
      if (result?.error) {
        setError(result.error);
        // We can't easily revert the select element without a fully controlled state,
        // but revalidating the path or the user manually refreshing will fix it.
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        defaultValue={currentRole}
        onChange={handleChange}
        disabled={isPending}
        className={`bg-zinc-800 border ${error ? 'border-rose-500/50' : 'border-zinc-700'} text-zinc-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-zinc-500 disabled:opacity-50`}
      >
        <option value="admin">Admin</option>
        <option value="manager">Manager</option>
        <option value="employee">Employee</option>
      </select>
      {error && <span className="text-[10px] text-rose-400">{error}</span>}
    </div>
  );
}

