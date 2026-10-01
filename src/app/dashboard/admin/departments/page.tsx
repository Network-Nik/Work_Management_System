import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DepartmentForm } from "./department-form";

export default async function AdminDepartmentsPage() {
  const staff = await requireApprovedStaff();

  if (staff.role !== 'admin' && !staff.isOwner) {
    redirect("/dashboard/admin");
  }

  const supabase = await createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("*")
    .eq("organization_id", staff.activeOrgId)
    .order("name", { ascending: true });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Departments</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage organizational structure</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {!departments || departments.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                No departments created yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {departments.map((dept) => (
                  <div key={dept.id} className={`p-4 flex items-center justify-between ${!dept.is_active ? 'opacity-50' : ''}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-zinc-200">{dept.name}</h3>
                        {!dept.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400">Archived</span>
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-xs text-zinc-400 mt-1">{dept.description}</p>
                      )}
                    </div>
                    {/* Basic edit button triggering state could go here, for V1 we keep it simple */}
                    <DepartmentForm
                       existingId={dept.id}
                       initialName={dept.name}
                       initialDesc={dept.description || undefined}
                       initialActive={dept.is_active}
                       expectedOrgId={staff.activeOrgId}
                       isEdit
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sticky top-20">
            <h2 className="text-lg font-semibold text-zinc-200 mb-4">Add Department</h2>
            <DepartmentForm expectedOrgId={staff.activeOrgId} />
          </div>
        </div>
      </div>
    </div>
  );
}
