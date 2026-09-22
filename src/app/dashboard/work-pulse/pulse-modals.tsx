"use client";

import { useState } from "react";
import { createWorkPulse, updateWorkPulse } from "./actions";
import { WorkPulseEntry, WorkPulseStatus } from "@/types/work-pulse";

export function CreatePulseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const estimatedEndAt = formData.get("estimatedEndAt") as string;

    const res = await createWorkPulse(title, description, estimatedEndAt);

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" aria-modal="true" role="dialog">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl my-auto animate-in zoom-in-95">
        <div className="p-6 border-b border-zinc-800/50 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold text-zinc-100">Update your Pulse</h3>
            <p className="text-sm text-zinc-400 mt-1">Let the team know what you&apos;re working on.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-zinc-300 mb-1">Title <span className="text-rose-500">*</span></label>
              <input
                id="title"
                name="title"
                type="text"
                required
                placeholder="e.g. 50-second reel"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-1">Details <span className="text-zinc-500 text-xs font-normal">(optional)</span></label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
            </div>

            <div>
              <label htmlFor="estimatedEndAt" className="block text-sm font-medium text-zinc-300 mb-1">Estimated End <span className="text-zinc-500 text-xs font-normal">(optional)</span></label>
              <input
                id="estimatedEndAt"
                name="estimatedEndAt"
                type="datetime-local"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {error && <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400">{error}</div>}

          <div className="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Pulse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditPulseModal({ entry, onClose }: { entry: WorkPulseEntry | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<WorkPulseStatus>(entry?.status || "in_progress");

  if (!entry) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const estimatedEndAt = formData.get("estimatedEndAt") as string;

    const res = await updateWorkPulse(entry.id, title, description, status, estimatedEndAt);

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  };

  const handleMarkCompleted = async () => {
    setLoading(true);
    setError("");
    const res = await updateWorkPulse(entry.id, entry.title, entry.description, "completed", entry.estimatedEndAt);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  };

  // Convert UTC datetime to local for datetime-local input
  const defaultDate = entry.estimatedEndAt 
    ? new Date(entry.estimatedEndAt).toISOString().slice(0, 16) 
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" aria-modal="true" role="dialog">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl my-auto animate-in zoom-in-95">
        <div className="p-6 border-b border-zinc-800/50 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold text-zinc-100">Edit Pulse</h3>
            <p className="text-sm text-zinc-400 mt-1">Update status or mark as completed.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-title" className="block text-sm font-medium text-zinc-300 mb-1">Title <span className="text-rose-500">*</span></label>
              <input
                id="edit-title"
                name="title"
                type="text"
                required
                defaultValue={entry.title}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-zinc-300 mb-1">Details</label>
              <textarea
                id="edit-description"
                name="description"
                rows={3}
                defaultValue={entry.description || ""}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-status" className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
                <select
                  id="edit-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkPulseStatus)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-estimatedEndAt" className="block text-sm font-medium text-zinc-300 mb-1">Estimated End</label>
                <input
                  id="edit-estimatedEndAt"
                  name="estimatedEndAt"
                  type="datetime-local"
                  defaultValue={defaultDate}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          </div>

          {error && <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400">{error}</div>}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={handleMarkCompleted}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Mark Completed
            </button>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition shadow-sm disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
