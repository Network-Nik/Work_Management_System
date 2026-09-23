import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

import { RegistrationActions } from "@/app/dashboard/admin/registration-actions";
import { AssignWorkModal } from "./assign-work-modal";
import { AcceptDeclineButtons, CompleteButton } from "./assignment-actions";
import { CompanyProgressChart } from "./components/company-progress-chart";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function DashboardGreeting() {
  const staff = await requireApprovedStaff();
  let staffList: any[] = [];

  if (staff.role === "admin" || staff.role === "manager") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        role,
        display_name,
        username,
        job_title
      `)
      .eq("organization_id", staff.activeOrgId)
      .eq("access_status", "approved");

    if (data) {
      // For admins/owners, fetch emails via secure RPC
      let emailMap = new Map<string, string>();
      if (staff.role === "admin" || staff.isOwner) {
        const userIds = data.map((d: any) => d.user_id);
        const { data: contacts } = await supabase.rpc("get_org_member_contacts", {
          p_org_id: staff.activeOrgId,
          p_user_ids: userIds,
        });
        if (contacts) {
          for (const c of contacts) {
            emailMap.set(c.user_id, c.email);
          }
        }
      }

      staffList = data.map((d: any) => ({
        user_id: d.user_id,
        email: emailMap.get(d.user_id) || "",
        role: d.role,
        display_name: d.display_name,
        username: d.username,
        job_title: d.job_title
      })).sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email));
    }
  }

  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
          {getGreeting()}, {staff.display_name || staff.email.split("@")[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Here&apos;s what&apos;s happening in your workspace today.
        </p>
      </div>
      {(staff.role === "admin" || staff.role === "manager") && (
        <AssignWorkModal staffList={staffList} />
      )}
    </div>
  );
}

function CardFrame({ title, children, action }: { title: string, children: React.ReactNode, action?: React.ReactNode }) {
  return (
    <section className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-200 ease-out hover:shadow-lg hover:shadow-black/20 hover:border-zinc-700">
      <div className="flex items-center justify-between p-5 border-b border-zinc-800/50 bg-zinc-900/50">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-300">{title}</h2>
        {action}
      </div>
      <div className="p-6 flex-1 flex flex-col">
        {children}
      </div>
    </section>
  );
}

function EmptyState({ message, icon }: { message: string, icon: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 mb-3">
        {icon}
      </div>
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

async function ActionRequiredCard() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("work_assignments")
    .select(`
      id, title, reference_id, description, assigned_at, target_deadline,
      assigner_id
    `)
    .eq("organization_id", staff.activeOrgId)
    .eq("assignee_id", staff.user_id)
    .eq("status", "pending")
    .order("assigned_at", { ascending: false });

  const allUserIds = [...new Set((assignments || []).map((a: any) => a.assigner_id))].filter(Boolean);
  let userMap = new Map();
  if (allUserIds.length > 0) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, display_name, username")
      .eq("organization_id", staff.activeOrgId)
      .in("user_id", allUserIds);
    userMap = new Map((members || []).map(m => [m.user_id, m]));
  }

  const items = (assignments ?? []).map((a: any) => ({
    ...a,
    assigner: { email: userMap.get(a.assigner_id)?.display_name || userMap.get(a.assigner_id)?.username || "?" }
  }));

  return (
    <CardFrame title="Action Required">
      {!items || items.length === 0 ? (
        <EmptyState
          message="Nothing needs your attention right now."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((a) => (
            <div key={a.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    {a.title}
                    {a.reference_id && (
                      <span className="ml-2 text-xs font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {a.reference_id}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">From: {(a.assigner as unknown as { email: string })?.email}</p>
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0 text-right">{formatDate(a.assigned_at)}</span>
              </div>
              {a.description && (
                <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{a.description}</p>
              )}
              {a.target_deadline && (
                <p className="text-xs text-amber-400/90 mb-3">
                  Suggested deadline: {formatDate(a.target_deadline)}
                </p>
              )}
              <AcceptDeclineButtons assignmentId={a.id} />
            </div>
          ))}
        </div>
      )}
    </CardFrame>
  );
}

async function ActiveWorkCard() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("work_assignments")
    .select(`
      id, title, reference_id, description, established_deadline, status,
      assigner_id
    `)
    .eq("organization_id", staff.activeOrgId)
    .eq("assignee_id", staff.user_id)
    .eq("status", "active")
    .order("established_deadline", { ascending: true, nullsFirst: false });

  const allUserIds = [...new Set((assignments || []).map((a: any) => a.assigner_id))].filter(Boolean);
  let userMap = new Map();
  if (allUserIds.length > 0) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, display_name, username")
      .eq("organization_id", staff.activeOrgId)
      .in("user_id", allUserIds);
    userMap = new Map((members || []).map(m => [m.user_id, m]));
  }

  const items2 = (assignments ?? []).map((a: any) => ({
    ...a,
    assigner: { email: userMap.get(a.assigner_id)?.display_name || userMap.get(a.assigner_id)?.username || "?" }
  }));

  return (
    <CardFrame title="Active Assignments">
      {!items2 || items2.length === 0 ? (
        <EmptyState
          message="You don't have any active assignments."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items2.map((a) => (
            <div key={a.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    {a.title}
                    {a.reference_id && (
                      <span className="ml-2 text-xs font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {a.reference_id}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">From: {(a.assigner as unknown as { email: string })?.email}</p>
                </div>
                {a.established_deadline && (
                  <span className="text-[10px] font-medium text-emerald-400/90 shrink-0 text-right">
                    Due: {formatDate(a.established_deadline)}
                  </span>
                )}
              </div>
              {a.description && (
                <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{a.description}</p>
              )}
              <CompleteButton assignmentId={a.id} />
            </div>
          ))}
        </div>
      )}
    </CardFrame>
  );
}

function UpcomingDeadlinesCard() {
  return (
    <CardFrame title="Upcoming Deadlines">
      <EmptyState
        message="No deadlines in the next 7 days."
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      />
    </CardFrame>
  );
}

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
  return formatDate(isoString);
}

const eventLabels: Record<string, { label: string; color: string }> = {
  created: { label: "Assigned", color: "text-blue-400" },
  accepted: { label: "Accepted", color: "text-emerald-400" },
  declined: { label: "Declined", color: "text-amber-400" },
  cancelled: { label: "Cancelled", color: "text-rose-400" },
  completed: { label: "Completed", color: "text-emerald-400" },
  deadline_updated: { label: "Deadline updated", color: "text-amber-400" },
  details_updated: { label: "Details updated", color: "text-zinc-400" },
};

async function RecentActivityCard() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("work_assignment_events")
    .select(`
      id, event_type, created_at, comment, actor_id,
      assignment:work_assignments!inner(title, organization_id)
    `)
    .eq("work_assignments.organization_id", staff.activeOrgId)
    .order("created_at", { ascending: false })
    .limit(10);

  const actorIds = [...new Set((events || []).map((e: any) => e.actor_id))].filter(Boolean);
  let actorsMap = new Map();
  if (actorIds.length > 0) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, display_name, username")
      .eq("organization_id", staff.activeOrgId)
      .in("user_id", actorIds);
    actorsMap = new Map((members || []).map(m => [m.user_id, m]));
  }

  const items = (events ?? []).map((e: any) => ({
    ...e,
    actor: { email: actorsMap.get(e.actor_id)?.display_name || actorsMap.get(e.actor_id)?.username || "?" }
  }));

  return (
    <CardFrame title="Recent Activity" action={<Link href="/dashboard/history" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition">View all</Link>}>
      {!items || items.length === 0 ? (
        <EmptyState
          message="No recent activity to show."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((event) => {
            const meta = eventLabels[event.event_type] ?? { label: event.event_type, color: "text-zinc-400" };
            const assignmentTitle = (event.assignment as unknown as { title: string } | null)?.title ?? "Unknown";
            const actorEmail = (event.actor as unknown as { email: string } | null)?.email;

            return (
              <div key={event.id} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30">
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${meta.color.replace("text-", "bg-")}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">
                    <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                    {" Â· "}
                    <span className="text-zinc-300">{assignmentTitle}</span>
                  </p>
                  {actorEmail && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">by {actorEmail.split("@")[0]}</p>
                  )}
                  {event.comment && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate italic">&ldquo;{event.comment}&rdquo;</p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">{formatRelativeTime(event.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </CardFrame>
  );
}

async function PendingRegistrationsCard() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();
  const { data: pendingStaff } = await supabase.rpc("get_org_staff_profiles", {
    p_org_id: staff.activeOrgId,
    p_access_status: "pending",
  });

  return (
    <CardFrame title="Pending Approvals" action={<Link href="/dashboard/admin" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition">Manage all</Link>}>
      {!pendingStaff || pendingStaff.length === 0 ? (
        <EmptyState
          message="No pending staff registrations."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {pendingStaff.slice(0, 5).map((staff) => (
            <div key={staff.user_id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-200">{staff.email}</span>
                <span className="text-xs text-zinc-500 font-mono mt-0.5">{staff.whatsapp_number}</span>
              </div>
              <RegistrationActions userId={staff.user_id} />
            </div>
          ))}
        </div>
      )}
    </CardFrame>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------
export default async function DashboardPage() {
  const staff = await requireApprovedStaff();

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Suspense fallback={<div className="h-16 w-64 bg-zinc-800 animate-pulse rounded-lg mb-8"></div>}>
        <DashboardGreeting />
      </Suspense>

      <div className="mb-6">
        <CompanyProgressChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<div className="h-64 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800"></div>}>
          <ActionRequiredCard />
        </Suspense>

        <Suspense fallback={<div className="h-64 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800"></div>}>
          <ActiveWorkCard />
        </Suspense>

        <UpcomingDeadlinesCard />
        <Suspense fallback={<div className="h-64 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800"></div>}>
          <RecentActivityCard />
        </Suspense>
      </div>

      {staff.role === 'admin' && (
        <div className="mt-8 pt-8 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-zinc-100">Admin Overview</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardFrame title="System Health">
               <div className="flex-1 flex items-center justify-center py-6">
                 <div className="flex items-center gap-2 text-emerald-400">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                   <span className="text-sm font-medium">All systems operational</span>
                 </div>
               </div>
            </CardFrame>
            <Suspense fallback={<div className="h-48 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800"></div>}>
              <PendingRegistrationsCard />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
