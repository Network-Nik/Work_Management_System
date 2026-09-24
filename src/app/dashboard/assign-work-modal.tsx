"use client";

import { useState } from "react";
import { assignWork } from "./actions";
import { useRouter } from "next/navigation";

type StaffMember = {
  user_id: string;
  email: string;
  role: string;
  display_name?: string | null;
  username?: string | null;
  job_title?: string | null;
};

export function AssignWorkModal({ staffList, expectedOrgId }: { staffList: StaffMember[], expectedOrgId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await assignWork(formData);

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition shadow-sm"
      >
        Assign Work
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl my-auto">
            <div className="p-6 border-b border-zinc-800/50">
              <h3 className="text-xl font-semibold text-zinc-100">Assign Work</h3>
              <p className="text-sm text-zinc-400 mt-1">Create a new task and assign it to a team member.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <input type="hidden" name="expectedOrgId" value={expectedOrgId} />
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Title <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="title"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                    placeholder="E.g. Review Q3 Reports"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Assignee <span className="text-rose-500">*</span></label>
                  <select
                    name="assignee_id"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500 transition appearance-none"
                  >
                    <option value="">Select a team member...</option>
                    {staffList.map((staff) => {
                      const displayName = staff.display_name ? `${staff.display_name} (@${staff.username})` : staff.email;
                      const title = staff.job_title ? ` - ${staff.job_title}` : '';
                      return (
                        <option key={staff.user_id} value={staff.user_id}>
                          {displayName}{title}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Reference ID (Optional)</label>
                  <input
                    type="text"
                    name="reference_id"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                    placeholder="E.g. TKT-1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Suggested Deadline (Optional)</label>
                  <input
                    type="datetime-local"
                    name="target_deadline"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Description (Optional)</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500 transition resize-none"
                    placeholder="Provide additional details..."
                  />
                </div>
              </div>

              {error && <p className="text-sm text-rose-400 mt-4">{error}</p>}

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition shadow-sm"
                >
                  {loading ? "Assigning..." : "Assign Work"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

