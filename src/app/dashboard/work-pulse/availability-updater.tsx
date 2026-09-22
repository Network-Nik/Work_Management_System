"use client";

import { useState } from "react";
import { updateMyAvailability } from "./actions";
import { AvailabilityStatus } from "@/types/work-pulse";

const statuses: { value: AvailabilityStatus; label: string; color: string; dot: string }[] = [
  { value: "available", label: "Available", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  { value: "focused", label: "Focused", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", dot: "bg-indigo-400" },
  { value: "busy", label: "Busy", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" },
  { value: "away", label: "Away", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20", dot: "bg-zinc-400" },
];

export function AvailabilityUpdater({ currentAvailability }: { currentAvailability: AvailabilityStatus }) {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const current = statuses.find((s) => s.value === currentAvailability) || statuses[0];

  const handleUpdate = async (value: AvailabilityStatus) => {
    if (value === currentAvailability) {
      setIsOpen(false);
      return;
    }
    
    setLoading(true);
    setIsOpen(false); // optimistic close
    await updateMyAvailability(value);
    setLoading(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition ${current.color} hover:opacity-80 disabled:opacity-50`}
        aria-label={`Current status: ${current.label}. Click to change.`}
        aria-expanded={isOpen}
      >
        <span className={`w-2 h-2 rounded-full ${current.dot}`} aria-hidden="true" />
        {current.label}
        <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2">
            {statuses.map((status) => (
              <button
                key={status.value}
                onClick={() => handleUpdate(status.value)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition text-left"
              >
                <span className={`w-2 h-2 rounded-full ${status.dot}`} aria-hidden="true" />
                {status.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

