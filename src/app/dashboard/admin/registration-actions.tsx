"use client";

import { useTransition } from "react";
import { approveStaff, rejectStaff } from "./actions";

export function RegistrationActions({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          startTransition(async () => {
            await rejectStaff(userId);
          });
        }}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Reject
      </button>
      <button
        onClick={() => {
          startTransition(async () => {
            await approveStaff(userId);
          });
        }}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Approve
      </button>
    </div>
  );
}

