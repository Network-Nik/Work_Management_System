import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

import { RegistrationActions } from "@/app/dashboard/admin/registration-actions";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

async function DashboardGreeting() {
  const staff = await requireApprovedStaff();
  return (
    <div className="mb-8">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
        {getGreeting()}, {staff.email.split("@")[0]}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Here&apos;s what&apos;s happening in your workspace today.
      </p>
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

function ActionRequiredCard() {
  return (
    <CardFrame title="Action Required">
      <EmptyState 
        message="Nothing needs your attention right now."
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        }
      />
    </CardFrame>
  );
}

function ActiveWorkCard() {
  return (
    <CardFrame title="Active Work">
      <EmptyState 
        message="You don't have any active work."
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
      />
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

function RecentActivityCard() {
  return (
    <CardFrame title="Recent Activity" action={<Link href="/dashboard/history" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition">View all</Link>}>
      <EmptyState 
        message="No recent activity to show."
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </CardFrame>
  );
}

async function PendingRegistrationsCard() {
  const supabase = await createClient();
  const { data: pendingStaff } = await supabase
    .from("staff_profiles")
    .select("user_id, email, whatsapp_number, created_at")
    .eq("access_status", "pending")
    .order("created_at", { ascending: true });

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionRequiredCard />
        <ActiveWorkCard />
        <UpcomingDeadlinesCard />
        <RecentActivityCard />
      </div>

      {staff.is_admin && (
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
