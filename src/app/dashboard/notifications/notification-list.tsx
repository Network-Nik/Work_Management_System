"use client";

import { useTransition } from "react";
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";

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

type NotificationItem = {
  id: string;
  type: "assigned" | "accepted" | "declined" | "completed" | "cancelled" | "deadline_override";
  is_read: boolean;
  created_at: string;
  actor: { email: string } | null;
  assignment: { title: string } | null;
};

const typeLabels: Record<NotificationItem["type"], string> = {
  assigned: "New work assigned",
  accepted: "Work accepted",
  declined: "Work declined",
  completed: "Work completed",
  cancelled: "Work cancelled",
  deadline_override: "Deadline updated",
};

export function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMarkAsRead = (id: string) => {
    startTransition(async () => {
      await markNotificationAsRead(id);
      router.refresh();
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsAsRead();
      router.refresh();
    });
  };

  const hasUnread = notifications.some((n) => !n.is_read);

  if (notifications.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="text-sm text-zinc-400">No notifications yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {hasUnread && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
          >
            Mark all as read
          </button>
        </div>
      )}
      
      <div className="flex flex-col gap-3">
        {notifications.map((n) => {
          const isUnread = !n.is_read;
          const actorEmail = n.actor?.email?.split("@")[0] ?? "Someone";
          const title = n.assignment?.title ?? "a task";
          const label = typeLabels[n.type] ?? "Notification";

          return (
            <div
              key={n.id}
              className={`group flex items-start gap-4 p-4 rounded-xl border transition-all ${
                isUnread 
                  ? "bg-zinc-900/80 border-zinc-700 shadow-sm" 
                  : "bg-zinc-900/30 border-zinc-800/40 opacity-80"
              }`}
            >
              <div className="mt-1.5 w-2 h-2 rounded-full shrink-0 flex items-center justify-center">
                {isUnread && <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <p className={`text-sm ${isUnread ? "font-semibold text-zinc-100" : "font-medium text-zinc-300"}`}>
                    {label}
                  </p>
                  <span className="text-[10px] text-zinc-500 shrink-0 mt-0.5 whitespace-nowrap">
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
                
                <p className={`text-sm ${isUnread ? "text-zinc-400" : "text-zinc-500"}`}>
                  <span className="text-zinc-300">{actorEmail}</span> {n.type === "assigned" ? "assigned you" : n.type.replace("_", " ")} <span className="font-medium text-zinc-300">{title}</span>.
                </p>
              </div>

              {isUnread && (
                <button
                  onClick={() => handleMarkAsRead(n.id)}
                  disabled={isPending}
                  className="mt-1 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-50"
                  title="Mark as read"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

