"use client";

import { useState } from "react";
import { adminEditMemberProfile } from "./actions";

type Department = { id: string; name: string };

type EditProfileModalProps = {
  member: {
    user_id: string;
    display_name: string | null;
    username: string | null;
    job_title: string | null;
    department_id: string | null;
  };
  departments: Department[];
};

export function EditProfileModal({ member, departments }: EditProfileModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const displayName = formData.get("display_name") as string;
    const username = formData.get("username") as string;
    const jobTitle = formData.get("job_title") as string;
    const departmentId = formData.get("department_id") as string;

    const result = await adminEditMemberProfile(member.user_id, {
      display_name: displayName.trim() || undefined,
      username: username.trim() || undefined,
      job_title: jobTitle.trim() || null,
      department_id: departmentId || null,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setIsOpen(false);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors"
      >
        Edit Profile
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-800/60 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">Edit Profile</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                ?
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-900/50 text-red-400 text-sm rounded-xl">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  name="display_name"
                  defaultValue={member.display_name || ""}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium text-sm">@</span>
                  <input
                    type="text"
                    name="username"
                    defaultValue={member.username || ""}
                    required
                    pattern="^[a-z0-9_-]{3,30}$"
                    title="3-30 characters, lowercase letters, numbers, underscores, and hyphens only"
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Job Title
                </label>
                <input
                  type="text"
                  name="job_title"
                  defaultValue={member.job_title || ""}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Department
                </label>
                <select
                  name="department_id"
                  defaultValue={member.department_id || ""}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                >
                  <option value="">None</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
