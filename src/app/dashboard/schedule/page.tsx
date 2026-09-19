import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthKey(isoString: string) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

const statusStyles: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-amber-400/10", text: "text-amber-400" },
  active: { label: "Active", bg: "bg-emerald-400/10", text: "text-emerald-400" },
};

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

function SectionFrame({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-zinc-800/50 bg-zinc-900/50">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-300">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">{children}</div>
    </section>
  );
}

function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 mb-3">
        {icon}
      </div>
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

const calendarIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const checkIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Active Work Section
// ---------------------------------------------------------------------------

type ActiveAssignment = {
  id: string;
  title: string;
  reference_id: string | null;
  status: string;
  assigned_at: string;
  target_deadline: string | null;
  established_deadline: string | null;
  assigner: { email: string } | null;
  assignee: { email: string } | null;
};

async function ActiveWorkSection() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("work_assignments")
    .select(`
      id, title, reference_id, status, assigned_at, target_deadline, established_deadline,
      assigner_id,
      assignee_id
    `)
    .in("status", ["pending", "active"])
    .order("established_deadline", { ascending: true, nullsFirst: false })
    .order("assigned_at", { ascending: false });

  const allAssignmentIds = [...new Set((assignments || []).map((a: any) => a.id))].filter(Boolean);
  let userMap = new Map();
  if (allAssignmentIds.length > 0) {
    const { data: identities } = await supabase.rpc("resolve_assignment_identities", {
      p_assignment_ids: allAssignmentIds
    });
    userMap = new Map((identities || []).map((i: any) => [i.user_id, i]));
  }

  const items = (assignments ?? []).map((a: any) => ({
    ...a,
    assigner: { email: userMap.get(a.assigner_id)?.display_name || userMap.get(a.assigner_id)?.username || "?" },
    assignee: { email: userMap.get(a.assignee_id)?.display_name || userMap.get(a.assignee_id)?.username || "?" }
  })) as unknown as ActiveAssignment[];

  return (
    <SectionFrame title="Active Work" count={items.length}>
      {items.length === 0 ? (
        <EmptyState message="No active or pending work right now." icon={calendarIcon} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => {
            const style = statusStyles[a.status] ?? statusStyles.pending;
            const deadline = a.status === "active" ? a.established_deadline : null;
            const suggestedDeadline = a.status === "pending" ? a.target_deadline : null;
            const overdue = a.status === "active" && isOverdue(a.established_deadline);

            return (
              <Link
                key={a.id}
                href={`/dashboard/assignments/${a.id}`}
                className={`block p-4 rounded-xl border bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors ${overdue ? "border-rose-500/40" : "border-zinc-800"}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-zinc-200 truncate">{a.title}</h3>
                      {a.reference_id && (
                        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                          {a.reference_id}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                      <span>From: {a.assigner?.email?.split("@")[0] ?? "—"}</span>
                      <span className="text-zinc-700">·</span>
                      <span>To: {a.assignee?.email?.split("@")[0] ?? "—"}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0 text-right mt-0.5">
                    {formatShortDate(a.assigned_at)}
                  </span>
                </div>

                {deadline && (
                  <div className={`text-xs mt-1 ${overdue ? "text-rose-400 font-medium" : "text-emerald-400/80"}`}>
                    {overdue ? "Overdue — " : "Due: "}
                    {formatDate(deadline)}
                  </div>
                )}
                {suggestedDeadline && (
                  <div className="text-xs text-amber-400/70 mt-1">
                    Suggested deadline: {formatDate(suggestedDeadline)}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </SectionFrame>
  );
}

// ---------------------------------------------------------------------------
// Completed History Section
// ---------------------------------------------------------------------------

type CompletedAssignment = {
  id: string;
  title: string;
  reference_id: string | null;
  completed_at: string;
  assigner: { email: string } | null;
  assignee: { email: string } | null;
};

async function CompletedHistorySection() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("work_assignments")
    .select(`
      id, title, reference_id, completed_at,
      assigner_id,
      assignee_id
    `)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  const allAssignmentIds = [...new Set((assignments || []).map((a: any) => a.id))].filter(Boolean);
  let userMap = new Map();
  if (allAssignmentIds.length > 0) {
    const { data: identities } = await supabase.rpc("resolve_assignment_identities", {
      p_assignment_ids: allAssignmentIds
    });
    userMap = new Map((identities || []).map((i: any) => [i.user_id, i]));
  }

  const items = (assignments ?? []).map((a: any) => ({
    ...a,
    assigner: { email: userMap.get(a.assigner_id)?.display_name || userMap.get(a.assigner_id)?.username || "?" },
    assignee: { email: userMap.get(a.assignee_id)?.display_name || userMap.get(a.assignee_id)?.username || "?" }
  })) as unknown as CompletedAssignment[];

  // Group by month
  const groups = new Map<string, CompletedAssignment[]>();
  for (const item of items) {
    const key = getMonthKey(item.completed_at);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return (
    <SectionFrame title="Completed History" count={items.length}>
      {items.length === 0 ? (
        <EmptyState message="No completed work yet." icon={checkIcon} />
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groups.entries()).map(([monthKey, monthItems]) => (
            <div key={monthKey}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                {formatMonthLabel(monthKey)}
              </h3>
              <div className="flex flex-col gap-1.5">
                {monthItems.map((a) => (
                  <Link
                    key={a.id}
                    href={`/dashboard/assignments/${a.id}`}
                    className="block flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-800/40 bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-300 truncate">{a.title}</span>
                        {a.reference_id && (
                          <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded shrink-0">
                            {a.reference_id}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-600">
                        <span>{a.assigner?.email?.split("@")[0] ?? "—"} → {a.assignee?.email?.split("@")[0] ?? "—"}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-600 shrink-0">
                      {formatShortDate(a.completed_at)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionFrame>
  );
}

// ---------------------------------------------------------------------------
// Main Schedule Page
// ---------------------------------------------------------------------------

export default async function SchedulePage() {
  await requireApprovedStaff();

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">Schedule</h1>
        <p className="mt-1 text-sm text-zinc-400">Your work assignments and completion history.</p>
      </div>

      <div className="flex flex-col gap-6">
        <Suspense fallback={<div className="h-64 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800" />}>
          <ActiveWorkSection />
        </Suspense>

        <Suspense fallback={<div className="h-48 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800" />}>
          <CompletedHistorySection />
        </Suspense>
      </div>
    </div>
  );
}
