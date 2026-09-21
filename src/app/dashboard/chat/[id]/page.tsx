import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";
import { MessageList } from "../components/message-list";
import { MessageComposer } from "../components/message-composer";
import { notFound } from "next/navigation";

export default async function ActiveChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: conv, error: convError } = await supabase
    .from("chat_conversations")
    .select("type, is_active, departments(is_active)")
    .eq("id", id)
    .single();

  if (convError || !conv) {
    notFound();
  }

  let canSend = conv.is_active;
  if (conv.type === "department" && conv.departments) {
    // Handle array or object just in case PostgREST maps it either way
    const dept: any = Array.isArray(conv.departments) ? conv.departments[0] : conv.departments;
    if (dept && dept.is_active === false) {
      canSend = false;
    }
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender_id, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  let identityMap: Record<string, { display_name: string; username: string }> = {};
  if (messages && messages.length > 0) {
    const { data: identities } = await supabase.rpc("resolve_chat_identities", {
      p_conversation_ids: [id],
    });

    if (identities) {
      identities.forEach((id: any) => {
        identityMap[id.user_id] = {
          display_name: id.display_name,
          username: id.username,
        };
      });
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MessageList
        messages={messages || []}
        identityMap={identityMap}
        currentUserId={staff.user_id}
      />

      {canSend ? (
        <MessageComposer conversationId={id} />
      ) : (
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 text-center">
          <p className="text-sm text-zinc-400">
            {conv.type === "department"
              ? "This department channel is archived and read-only."
              : "This conversation is archived and read-only."}
          </p>
        </div>
      )}
    </div>
  );
}
