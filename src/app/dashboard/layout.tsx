import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { WorkspaceNav } from "@/app/dashboard/workspace-nav";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce authentication and approved staff status
  const staff = await requireApprovedStaff();

  const supabase = await createClient();
  const { count } = await supabase
    .from("in_app_notifications")
    .select('*', { count: 'exact', head: true })
    .eq("is_read", false);

  return (
    <div className="workspace-theme min-h-dvh bg-[var(--background)] text-[var(--foreground)] selection:bg-indigo-500/30">
      <WorkspaceNav staff={staff} unreadCount={count ?? 0} />

      {/*
        Main content area
        Desktop: offset by sidebar width (64 * 4px = 256px)
        Mobile: offset by bottom tab bar (16 * 4px = 64px) + safe area
      */}
      <div className="lg:pl-64 pb-16 lg:pb-0 min-h-dvh flex flex-col">
        {/* Top Header - Mobile only */}
        <header className="lg:hidden h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30 flex items-center px-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Workspace
          </p>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

