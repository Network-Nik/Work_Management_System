"use client";

import { useState } from "react";
import { acceptWork, declineWork, completeWork } from "./actions";
import { useRouter } from "next/navigation";

export function AcceptDeclineButtons({ assignmentId }: { assignmentId: string }) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reason, setReason] = useState("");
  const router = useRouter();

  const handleAccept = async () => {
    if (!deadline) {
      setError("Please select a deadline");
      return;
    }
    setLoading(true);
    setError("");
    const res = await acceptWork(assignmentId, new Date(deadline).toISOString());
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsAccepting(false);
      setDeadline("");
      router.refresh();
    }
  };

  const handleDecline = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    setLoading(true);
    setError("");
    const res = await declineWork(assignmentId, reason);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsDeclining(false);
      setReason("");
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => setIsAccepting(true)}
          className="px-3 py-1.5 text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition"
        >
          Accept
        </button>
        <button
          onClick={() => setIsDeclining(true)}
          className="px-3 py-1.5 text-sm font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition"
        >
          Decline
        </button>
      </div>

      {isAccepting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Accept Work</h3>
            <p className="text-sm text-zinc-400 mb-4">Commit to a deadline for this assignment.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Established Deadline</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsAccepting(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={loading || !deadline}
                className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition"
              >
                {loading ? "Accepting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeclining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Decline Work</h3>
            <p className="text-sm text-zinc-400 mb-4">Please provide a reason for declining.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500 transition resize-none"
                placeholder="e.g. Current workload is too high"
              />
            </div>

            {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsDeclining(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={loading || !reason.trim()}
                className="px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 transition"
              >
                {loading ? "Declining..." : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CompleteButton({ assignmentId }: { assignmentId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleComplete = async () => {
    setLoading(true);
    const res = await completeWork(assignmentId);
    setLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="mt-4 px-3 py-1.5 text-sm font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition disabled:opacity-50"
    >
      {loading ? "Completing..." : "Complete"}
    </button>
  );
}

