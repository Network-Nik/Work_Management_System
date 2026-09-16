"use client";

import { useState } from "react";

function formatRelativeTime(isoString: string) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFullDate(isoString: string) {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type EventType = "created" | "accepted" | "declined" | "cancelled" | "completed" | "deadline_updated" | "details_updated";

export type TimelineEvent = {
  id: string;
  event_type: EventType;
  comment: string | null;
  created_at: string;
  actor: { email: string } | null;
  assignment: { title: string; reference_id: string | null } | null;
};

const eventLabels: Record<EventType, string> = {
  created: "Assigned",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  deadline_updated: "Deadline updated",
  details_updated: "Details updated",
};

const statusChanges = new Set(["created", "accepted", "declined", "cancelled", "completed"]);

export function HistoryTimeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<"all" | "status" | "deadline">("all");

  const filteredEvents = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "status") return statusChanges.has(e.event_type);
    if (filter === "deadline") return e.event_type === "deadline_updated";
    return true;
  });

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 bg-zinc-900/50 p-1.5 rounded-lg border border-zinc-800/50 self-start">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === "all" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("status")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === "status" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Status Changes
        </button>
        <button
          onClick={() => setFilter("deadline")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === "deadline" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Deadline Changes
        </button>
      </div>

      {/* Empty State */}
      {events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">No history yet.</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-zinc-500">No matching events for this filter.</p>
        </div>
      ) : (
        <div className="relative border-l border-zinc-800/60 ml-3 md:ml-4 flex flex-col gap-8 pb-4">
          {filteredEvents.map((event) => {
            const actorEmail = event.actor?.email?.split("@")[0] ?? "System";
            const title = event.assignment?.title ?? "Unknown assignment";
            const label = eventLabels[event.event_type] ?? event.event_type;
            
            // Visual treatments per type
            const isCompleted = event.event_type === "completed";
            const isWarning = event.event_type === "declined" || event.event_type === "cancelled";
            const isDeadline = event.event_type === "deadline_updated";
            
            const dotColor = isCompleted
              ? "bg-emerald-500 border-emerald-950"
              : isWarning
              ? "bg-rose-500 border-rose-950"
              : isDeadline
              ? "bg-amber-500 border-amber-950"
              : "bg-indigo-500 border-indigo-950";

            return (
              <div key={event.id} className="relative pl-6 md:pl-8">
                {/* Timeline dot */}
                <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${dotColor}`} />
                
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-semibold text-zinc-200">
                      {label}
                    </span>
                    <span className="text-sm text-zinc-500">by</span>
                    <span className="text-sm font-medium text-zinc-300">
                      {actorEmail}
                    </span>
                  </div>
                  <div className="flex flex-col sm:items-end shrink-0">
                    <span className="text-xs text-zinc-500" title={formatFullDate(event.created_at)}>
                      {formatRelativeTime(event.created_at)}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-zinc-300 font-medium truncate">{title}</p>
                    {event.assignment?.reference_id && (
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded shrink-0">
                        {event.assignment.reference_id}
                      </span>
                    )}
                  </div>
                  
                  {event.comment && (
                    <div className="mt-3 pl-3 border-l-2 border-zinc-700">
                      <p className="text-sm text-zinc-400 italic whitespace-pre-wrap">
                        {event.comment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

