"use client";

import { useState } from "react";
import { addOwner, removeOwner } from "./actions";

type Owner = {
  user_id: string;
  staff_profiles: { email: string } | null;
};

type Props = {
  currentUserId: string;
  owners: Owner[];
  approvedStaff: { user_id: string; email: string }[];
};

export function OwnershipControls({ currentUserId, owners, approvedStaff }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");

  const handleAdd = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setError(null);
    const result = await addOwner(selectedUser);
    if (result?.error) {
      setError(result.error);
    } else {
      setSelectedUser("");
    }
    setLoading(false);
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this owner? They will lose ownership access but remain an Admin.")) return;
    setLoading(true);
    setError(null);
    const result = await removeOwner(userId);
    if (result?.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  // Filter out existing owners from the dropdown
  const availableStaff = approvedStaff.filter(
    (s) => !owners.some((o) => o.user_id === s.user_id)
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-12">
      <div className="p-6 border-b border-zinc-800/50">
        <h2 className="text-lg font-semibold text-zinc-200">Organization Ownership</h2>
        <p className="text-sm text-zinc-500 mt-1">Super Admins with full authority. Maximum of 2 allowed.</p>
        
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-900/50 text-red-400 text-sm rounded-xl">
            {error}
          </div>
        )}
      </div>

      <div className="divide-y divide-zinc-800/50">
        {owners.map((owner) => (
          <div key={owner.user_id} className="p-4 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-900/30 flex items-center justify-center border border-blue-800/50">
                <span className="text-xs font-medium text-blue-400">SA</span>
              </div>
              <p className="text-sm font-medium text-zinc-200">
                {owner.staff_profiles?.email || "Unknown User"}
                {owner.user_id === currentUserId && <span className="ml-2 text-xs text-zinc-500">(You)</span>}
              </p>
            </div>
            {owner.user_id !== currentUserId && owners.length > 1 && (
              <button
                disabled={loading}
                onClick={() => handleRemove(owner.user_id)}
                className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {owners.length < 2 && (
        <div className="p-4 px-6 bg-zinc-900/50 flex items-center gap-3 border-t border-zinc-800/50">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            disabled={loading || availableStaff.length === 0}
            className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-700"
          >
            <option value="">Select an approved member...</option>
            {availableStaff.map((staff) => (
              <option key={staff.user_id} value={staff.user_id}>
                {staff.email}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={loading || !selectedUser}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            Add Owner
          </button>
        </div>
      )}
    </div>
  );
}

