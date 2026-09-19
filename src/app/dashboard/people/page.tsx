import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";
import { EditProfileModal } from "./edit-profile-modal";

export default async function PeopleDirectoryPage() {
  const staff = await requireApprovedStaff();
  
  const supabase = await createClient();
  
  // Fetch departments for filtering (if needed in future)
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("organization_id", staff.activeOrgId)
    .eq("is_active", true)
    .order("name");

  // Fetch all approved members
  const { data: members } = await supabase
    .from("organization_members")
    .select(`
      user_id,
      display_name,
      username,
      job_title,
      role,
      department_id
    `)
    .eq("organization_id", staff.activeOrgId)
    .eq("access_status", "approved")
    .order("display_name");

  // Determine if viewer is admin/owner
  const isPrivileged = staff.role === "admin" || staff.isOwner;

  // For privileged users, fetch contact info via secure RPC
  let contactMap = new Map<string, { email: string; whatsapp_number: string | null }>();
  if (isPrivileged && members && members.length > 0) {
    const userIds = members.map((m: any) => m.user_id);
    const { data: contacts } = await supabase.rpc("get_org_member_contacts", {
      p_org_id: staff.activeOrgId,
      p_user_ids: userIds,
    });
    if (contacts) {
      for (const c of contacts) {
        contactMap.set(c.user_id, { email: c.email, whatsapp_number: c.whatsapp_number });
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">People</h1>
        <p className="text-sm text-zinc-400 mt-1">Directory of organization members</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members?.map((member: any) => {
          const dept = departments?.find(d => d.id === member.department_id);
          
          return (
            <div key={member.user_id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-100 truncate">{member.display_name || "Unknown"}</h3>
                  <p className="text-sm font-medium text-blue-400 mt-0.5">@{member.username || "unknown"}</p>
                </div>
                {member.role === 'admin' && (
                  <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-md text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              
              <div className="mt-4 space-y-1.5">
                {member.job_title && (
                  <p className="text-sm text-zinc-300 flex items-center gap-2">
                    <span className="text-zinc-500 text-xs w-4">💼</span>
                    {member.job_title}
                  </p>
                )}
                {dept && (
                  <p className="text-sm text-zinc-300 flex items-center gap-2">
                    <span className="text-zinc-500 text-xs w-4">🏢</span>
                    {dept.name}
                  </p>
                )}
              </div>

              {isPrivileged && contactMap.has(member.user_id) && (
                <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-1">
                  <p className="text-xs text-zinc-500 truncate">
                    <span className="font-medium">Email:</span> {contactMap.get(member.user_id)!.email}
                  </p>
                  {contactMap.get(member.user_id)!.whatsapp_number && (
                    <p className="text-xs text-zinc-500 truncate">
                      <span className="font-medium">WhatsApp:</span> {contactMap.get(member.user_id)!.whatsapp_number}
                    </p>
                  )}
                </div>
              )}
              {isPrivileged && (
                <div className="mt-4 pt-4 border-t border-zinc-800/50 flex justify-end">
                  <EditProfileModal member={member} departments={departments || []} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

