import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { signOut } from "@/app/auth/actions";

export default async function ProfilePage() {
  const staff = await requireApprovedStaff();
  
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight mb-8">Profile & Settings</h1>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Account Information</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b border-zinc-800/50">
            <span className="text-zinc-500 text-sm">Email</span>
            <span className="text-zinc-200 text-sm font-medium">{staff.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-800/50">
            <span className="text-zinc-500 text-sm">WhatsApp Number</span>
            <span className="text-zinc-200 text-sm font-mono">{staff.whatsapp_number}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-800/50">
            <span className="text-zinc-500 text-sm">Role</span>
            <span className="text-zinc-200 text-sm font-medium">{staff.role === 'admin' ? "Administrator" : staff.role === 'manager' ? "Manager" : "Employee"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-zinc-500 text-sm">Status</span>
            <span className="text-emerald-400 text-sm font-medium capitalize">{staff.access_status}</span>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Session Management</h2>
        <form action={signOut}>
          <button type="submit" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors">
            Sign out of workspace
          </button>
        </form>
      </div>
    </div>
  );
}

