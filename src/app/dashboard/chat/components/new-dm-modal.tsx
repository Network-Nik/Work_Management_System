"use client";

import { useState } from "react";
import { createDM } from "../actions";

type DirectoryMember = {
  user_id: string;
  display_name: string;
  username: string;
  job_title: string;
};

export function NewDmModal({
  directory,
  organizationId,
  currentUserId,
}: {
  directory: DirectoryMember[];
  organizationId: string;
  currentUserId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const others = directory.filter((d) => d.user_id !== currentUserId);

  const startDM = async (targetUserId: string) => {
    setLoading(true);
    setError("");
    const res = await createDM(organizationId, targetUserId);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100">New Direct Message</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {others.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No other members available.</p>
              ) : (
                <div className="space-y-2">
                  {others.map((member) => (
                    <button
                      key={member.user_id}
                      onClick={() => startDM(member.user_id)}
                      disabled={loading}
                      className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-between group disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {member.display_name || member.username}
                        </p>
                        {member.job_title && (
                          <p className="text-xs text-zinc-500 mt-0.5">{member.job_title}</p>
                        )}
                      </div>
                      <span className="text-xs font-medium text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Message
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
