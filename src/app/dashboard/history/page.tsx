import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { HistoryTimeline, TimelineEvent } from "./history-timeline";

async function HistoryFeed() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("work_assignment_events")
    .select(`
      id, event_type, comment, created_at,
      actor:staff_profiles!actor_id(email),
      assignment:work_assignments!assignment_id(title, reference_id)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (events ?? []) as unknown as TimelineEvent[];

  return (
    <section className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden p-4 sm:p-6">
      <HistoryTimeline events={items} />
    </section>
  );
}

export default async function HistoryPage() {
  await requireApprovedStaff();

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">History</h1>
        <p className="mt-1 text-sm text-zinc-400">Complete audit log of work assignment activity.</p>
      </div>

      <Suspense fallback={<div className="h-64 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800" />}>
        <HistoryFeed />
      </Suspense>
    </div>
  );
}
