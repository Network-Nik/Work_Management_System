"use client";

import { useTransition, useState } from "react";
import { addAllowlistEmail, removeAllowlistEmail } from "../actions";

export function AllowlistForm({
  emails,
  expectedOrgId,
}: {
  expectedOrgId: string;
  emails: { email: string; created_at: string; added_by: string | null }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await addAllowlistEmail(expectedOrgId, newEmail);
      if (result?.error) {
        setError(result.error);
      } else {
        setNewEmail("");
      }
    });
  };

  const handleRemove = (email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the allowlist?`)) return;
    
    setError(null);
    startTransition(async () => {
      const result = await removeAllowlistEmail(expectedOrgId, email);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/50">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new.employee@example.com"
            disabled={isPending}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
            required
          />
          <button
            type="submit"
            disabled={isPending || !newEmail.trim()}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            {isPending ? "Adding..." : "Add Email"}
          </button>
        </form>
        {error && <p className="text-sm text-rose-400 mt-2">{error}</p>}
      </div>

      {!emails || emails.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 text-sm">
          No emails in the allowlist.
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {emails.map((item) => (
            <div key={item.email} className="p-4 flex items-center justify-between group">
              <div>
                <p className="text-sm font-medium text-zinc-200">{item.email}</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Added {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleRemove(item.email)}
                disabled={isPending}
                className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                title="Remove from allowlist"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

