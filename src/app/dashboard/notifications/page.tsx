import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { NotificationList } from "./notification-list";

type NotificationItem = {
  id: string;
  type: "assigned" | "accepted" | "declined" | "completed" | "cancelled" | "deadline_override";
  is_read: boolean;
  created_at: string;
  actor: { email: string } | null;
  assignment: { title: string } | null;
};

async function NotificationInbox() {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("in_app_notifications")
    .select(`
      id, type, is_read, created_at, actor_id,
      assignment:work_assignments!assignment_id(title)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const actorIds = [...new Set((notifications || []).map((n: any) => n.actor_id))].filter(Boolean);
  let actorsMap = new Map();
  if (actorIds.length > 0) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, display_name, username")
      .eq("organization_id", staff.activeOrgId)
      .in("user_id", actorIds);
    actorsMap = new Map((members || []).map(m => [m.user_id, m]));
  }

  const items = (notifications ?? []).map((n: any) => ({
    ...n,
    actor: { email: actorsMap.get(n.actor_id)?.display_name || actorsMap.get(n.actor_id)?.username || "?" }
  })) as unknown as NotificationItem[];

  return (
    <section className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden p-6">
      <NotificationList notifications={items} />
    </section>
  );
}

export default async function NotificationsPage() {
  await requireApprovedStaff();

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">Notifications</h1>
        <p className="mt-1 text-sm text-zinc-400">Updates and activity on your work assignments.</p>
      </div>

      <Suspense fallback={<div className="h-64 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800" />}>
        <NotificationInbox />
      </Suspense>
    </div>
  );
}
