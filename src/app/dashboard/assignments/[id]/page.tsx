import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
function formatShortDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDateTime(isoString: string) {
  return new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
import { CommentForm } from "./comment-form";

export default async function AssignmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireApprovedStaff();
  const supabase = await createClient();

  const { data: assignment, error: assignmentError } = await supabase
    .from("work_assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (!assignment || assignmentError) {
    notFound();
  }

  const [eventsResp, commentsResp, identityResp] = await Promise.all([
    supabase.from("work_assignment_events").select("*").eq("assignment_id", assignment.id),
    supabase.from("work_assignment_comments").select("*").eq("assignment_id", assignment.id),
    supabase.rpc("resolve_assignment_identities", { p_assignment_ids: [assignment.id] })
  ]);

  const idMap = new Map(identityResp.data?.map(i => [i.user_id, i.display_name || i.username || "?"]) || []);

  type TimelineItem = 
    | { type: 'event'; date: string; data: any }
    | { type: 'comment'; date: string; data: any };

  const timeline: TimelineItem[] = [
    ...(eventsResp.data || []).map((e: any) => ({ type: 'event' as const, date: e.created_at, data: e })),
    ...(commentsResp.data || []).map((c: any) => ({ type: 'comment' as const, date: c.created_at, data: c }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const isComplete = assignment.status === 'completed';
  const isCancelled = assignment.status === 'cancelled';

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{assignment.title}</h1>
            {assignment.reference_id && (
              <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                {assignment.reference_id}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl">{assignment.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4">Timeline</h2>
            
            <div className="space-y-4">
              {timeline.length === 0 ? (
                <div className="text-sm text-zinc-500 text-center py-6">No history yet.</div>
              ) : (
                <div className="relative pl-3 border-l border-zinc-800 space-y-6">
                  {timeline.map((item, idx) => {
                    if (item.type === 'event') {
                      return (
                        <div key={"evt-" + item.data.id} className="relative">
                          <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-zinc-700 ring-4 ring-zinc-900" />
                          <div className="text-xs text-zinc-400 mb-0.5 flex items-center justify-between">
                            <span className="font-medium">{idMap.get(item.data.actor_id) || "System"}</span>
                            <span className="text-[10px]">{formatFullDateTime(item.date)}</span>
                          </div>
                          <div className="text-sm text-zinc-300">
                            {item.data.event_type === 'status_changed' && <span className="text-zinc-500">Status changed</span>}
                            {item.data.comment && <span className="ml-1 text-zinc-200">{item.data.comment}</span>}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={"cmt-" + item.data.id} className="relative">
                          <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-emerald-500/80 ring-4 ring-zinc-900" />
                          <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
                            <span className="font-semibold text-emerald-400/90">{idMap.get(item.data.author_id) || "?"}</span>
                            <span className="text-[10px]">{formatFullDateTime(item.date)}</span>
                          </div>
                          <div className="text-sm text-zinc-200 bg-zinc-800/40 p-3 rounded-lg border border-zinc-800/60 whitespace-pre-wrap">
                            {item.data.content}
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>

            {(!isComplete && !isCancelled) && <CommentForm assignmentId={assignment.id} />}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-5 text-sm">
            <h2 className="font-semibold text-zinc-200 mb-4">Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className="text-zinc-200 capitalize">{assignment.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Assigner</span>
                <span className="text-zinc-200">{idMap.get(assignment.assigner_id) || "?"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Assignee</span>
                <span className="text-zinc-200">{idMap.get(assignment.assignee_id) || "?"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Assigned</span>
                <span className="text-zinc-200">{formatShortDate(assignment.assigned_at)}</span>
              </div>
              {assignment.established_deadline && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Deadline</span>
                  <span className="text-zinc-200">{formatShortDate(assignment.established_deadline)}</span>
                </div>
              )}
              {assignment.completed_at && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Completed</span>
                  <span className="text-zinc-200">{formatShortDate(assignment.completed_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
