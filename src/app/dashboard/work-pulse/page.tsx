import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";
import { WorkPulseBoard } from "./work-pulse-board";
import { WorkPulseStaff, WorkPulseEntry, AvailabilityStatus } from "@/types/work-pulse";

export const metadata = {
  title: "Work Pulse | Dashboard",
};

export default async function WorkPulsePage() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  // Parallel data loading
  const [directoryRes, entriesRes] = await Promise.all([
    supabase.rpc("get_org_directory", { p_org_id: staff.activeOrgId }),
    supabase
      .from("work_pulse_entries")
      .select("id, user_id, title, description, status, started_at, estimated_end_at")
      .eq("organization_id", staff.activeOrgId)
      .in("status", ["in_progress", "blocked"]),
  ]);

  if (directoryRes.error) {
    throw new Error(directoryRes.error.message);
  }
  if (entriesRes.error) {
    throw new Error(entriesRes.error.message);
  }

  // Merge by user_id
  const entriesByUserId = (entriesRes.data || []).reduce((acc, entry) => {
    if (!acc[entry.user_id]) {
      acc[entry.user_id] = [];
    }
    acc[entry.user_id].push({
      id: entry.id,
      userId: entry.user_id,
      title: entry.title,
      description: entry.description,
      status: entry.status as "in_progress" | "blocked" | "completed",
      startedAt: entry.started_at,
      estimatedEndAt: entry.estimated_end_at,
    });
    return acc;
  }, {} as Record<string, WorkPulseEntry[]>);

  const mergedStaff: WorkPulseStaff[] = (directoryRes.data || []).map((user) => ({
    userId: user.user_id,
    displayName: user.display_name,
    username: user.username,
    jobTitle: user.job_title,
    departmentId: user.department_id,
    departmentName: user.department_name,
    availability: (user.availability || "available") as AvailabilityStatus,
    activeEntries: entriesByUserId[user.user_id] || [],
  }));

  // Group by department in memory
  const groupedByDepartment = mergedStaff.reduce((acc, current) => {
    const dept = current.departmentName || "No Department";
    if (!acc[dept]) {
      acc[dept] = [];
    }
    acc[dept].push(current);
    return acc;
  }, {} as Record<string, WorkPulseStaff[]>);

  // Convert to an array structure for easier client rendering
  const departments = Object.entries(groupedByDepartment)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, staffList]) => ({
      name,
      staffList: staffList.sort((a, b) => {
        // Sort current user to top within department, then alphabetically
        if (a.userId === staff.user_id) return -1;
        if (b.userId === staff.user_id) return 1;
        return (a.displayName || a.username || "").localeCompare(b.displayName || b.username || "");
      }),
    }));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/50">
      <div className="p-4 md:p-8 flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <WorkPulseBoard 
            departments={departments} 
            currentUserId={staff.user_id} 
            currentUserAvailability={staff.availability as AvailabilityStatus}
          />
        </div>
      </div>
    </div>
  );
}
