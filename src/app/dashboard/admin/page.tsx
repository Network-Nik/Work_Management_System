import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RegistrationActions } from "@/app/dashboard/admin/registration-actions";
import { RoleSelector } from "@/app/dashboard/admin/role-selector";
import { OwnershipControls } from "@/app/dashboard/admin/ownership-controls";

export default async function AdminPage() {
  const staff = await requireApprovedStaff();
  
  if (staff.role !== 'admin') {
    redirect("/dashboard");
  }
  
  const supabase = await createClient();
  
  let owners: any[] = [];
  if (staff.isOwner) {
    const { data: ownerRows } = await supabase
      .from("organization_owners")
      .select("user_id")
      .eq("organization_id", staff.activeOrgId);

    if (ownerRows && ownerRows.length > 0) {
      const ownerIds = ownerRows.map((o: any) => o.user_id);
      const { data: contacts } = await supabase.rpc("get_org_member_contacts", {
        p_org_id: staff.activeOrgId,
        p_user_ids: ownerIds,
      });
      const contactMap = new Map((contacts || []).map((c: any) => [c.user_id, c.email]));
      owners = ownerRows.map((o: any) => ({
        user_id: o.user_id,
        staff_profiles: { email: contactMap.get(o.user_id) || "Unknown" },
      }));
    }
  }

  const { data: pendingStaff } = await supabase.rpc("get_org_staff_profiles", {
    p_org_id: staff.activeOrgId,
    p_access_status: "pending",
  });

  const { data: approvedStaff } = await supabase.rpc("get_org_staff_profiles", {
    p_org_id: staff.activeOrgId,
    p_access_status: "approved",
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Staff Management</h1>
        <Link href="/dashboard/admin/allowlist" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors">
          Manage Allowlist
        </Link>
      </div>

      {staff.isOwner && (
        <OwnershipControls
          currentUserId={staff.user_id}
          owners={owners}
          approvedStaff={approvedStaff || []}
        />
      )}

      <div className="mb-12">
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">Pending Registrations</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {!pendingStaff || pendingStaff.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No pending registrations.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {pendingStaff.map((p) => (
                <div key={p.user_id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{p.email}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">{p.whatsapp_number}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Registered {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <RegistrationActions userId={p.user_id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">Approved Staff</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {!approvedStaff || approvedStaff.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No approved staff.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {approvedStaff.map((a) => (
                <div key={a.user_id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{a.email}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">{a.whatsapp_number}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleSelector userId={a.user_id} currentRole={a.role} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

