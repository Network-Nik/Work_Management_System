"use client";

import { useState } from "react";
import { WorkPulseStaff, WorkPulseEntry, AvailabilityStatus } from "@/types/work-pulse";
import { CreatePulseModal, EditPulseModal } from "./pulse-modals";
import { AvailabilityUpdater } from "./availability-updater";

type DepartmentGroup = {
  name: string;
  staffList: WorkPulseStaff[];
};

export function WorkPulseBoard({ 
  departments, 
  currentUserId,
  currentUserAvailability 
}: { 
  departments: DepartmentGroup[]; 
  currentUserId: string;
  currentUserAvailability: AvailabilityStatus;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkPulseEntry | null>(null);

  const getAvailabilityStyle = (status: AvailabilityStatus) => {
    switch (status) {
      case "available": return { color: "text-emerald-400", bg: "bg-emerald-400", label: "Available" };
      case "focused": return { color: "text-indigo-400", bg: "bg-indigo-400", label: "Focused" };
      case "busy": return { color: "text-amber-400", bg: "bg-amber-400", label: "Busy" };
      case "away": return { color: "text-zinc-400", bg: "bg-zinc-400", label: "Away" };
      default: return { color: "text-zinc-400", bg: "bg-zinc-400", label: "Unknown" };
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Work Pulse</h1>
          <p className="text-sm text-zinc-400">See what your team is working on right now.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <AvailabilityUpdater currentAvailability={currentUserAvailability} />
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition shadow-sm"
          >
            + New Pulse
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {departments.length === 0 && (
          <div className="text-center py-12 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
            <p className="text-zinc-400 text-sm">No active members found in this workspace.</p>
          </div>
        )}

        {departments.map((dept) => (
          <section key={dept.name} className="space-y-4">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-500 pl-1">{dept.name}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {dept.staffList.map((staff) => {
                const avail = getAvailabilityStyle(staff.availability);
                const isMe = staff.userId === currentUserId;

                return (
                  <div key={staff.userId} className={`bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col ${isMe ? 'ring-1 ring-indigo-500/30' : ''}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium text-zinc-300 shrink-0">
                          {(staff.displayName || staff.username || "?").substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-zinc-100 font-medium truncate flex items-center gap-2">
                            {staff.displayName || staff.username}
                            {isMe && <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">You</span>}
                          </h3>
                          <p className="text-xs text-zinc-400 truncate">{staff.jobTitle || "Team Member"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0" aria-label={`Status: ${avail.label}`}>
                        <span className={`w-2 h-2 rounded-full ${avail.bg}`} aria-hidden="true" />
                        <span className={`text-xs font-medium ${avail.color}`}>{avail.label}</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      {staff.activeEntries.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-4 bg-zinc-950/30 rounded-xl border border-dashed border-zinc-800/50 text-zinc-500 text-xs italic">
                          No active updates.
                        </div>
                      ) : (
                        staff.activeEntries.map((entry) => (
                          <div 
                            key={entry.id} 
                            onClick={() => isMe && setEditingEntry(entry)}
                            className={`p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 transition-colors ${isMe ? 'cursor-pointer hover:bg-zinc-950 hover:border-indigo-500/30' : ''}`}
                            role={isMe ? "button" : "article"}
                            aria-label={isMe ? "Edit pulse entry" : "Pulse entry"}
                          >
                            <div className="flex justify-between items-start gap-2 mb-1.5">
                              <h4 className="text-sm font-medium text-zinc-200 leading-snug">{entry.title}</h4>
                              {entry.status === "blocked" && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                  Blocked
                                </span>
                              )}
                            </div>
                            
                            {entry.description && (
                              <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{entry.description}</p>
                            )}
                            
                            {entry.estimatedEndAt && (
                              <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {new Date(entry.estimatedEndAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <CreatePulseModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />
      
      <EditPulseModal 
        entry={editingEntry} 
        onClose={() => setEditingEntry(null)} 
      />
    </>
  );
}

