import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "./components/conversation-list";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireApprovedStaff();
  const supabase = await createClient();

  const { data: rawConversations, error: convError } = await supabase
    .from("chat_conversations")
    .select(`
      id,
      type,
      department_id,
      dm_identifier,
      is_active,
      last_message_at,
      departments ( name ),
      chat_conversation_members ( user_id ),
      chat_conversation_reads ( last_read_at ),
      chat_messages ( content, created_at, sender_id )
    `)
    .order("last_message_at", { ascending: false })
    .order("created_at", { foreignTable: "chat_messages", ascending: false })
    .limit(1, { foreignTable: "chat_messages" });

  if (convError) throw convError;

  const conversations = (rawConversations || []).map((c: any) => {
    // Handle both array and object returns from PostgREST
    const reads = Array.isArray(c.chat_conversation_reads) ? c.chat_conversation_reads[0] : c.chat_conversation_reads;
    const lastReadAt = reads?.last_read_at || null;
    const lastMessageAt = c.last_message_at;
    const isUnread =
      lastMessageAt !== null &&
      (lastReadAt === null || new Date(lastMessageAt) > new Date(lastReadAt));

    const msgs = Array.isArray(c.chat_messages) ? c.chat_messages[0] : c.chat_messages;

    return {
      ...c,
      isUnread,
      latestMessage: msgs || null,
    };
  });

  let identityMap: Record<string, { display_name: string; username: string }> = {};

  if (conversations && conversations.length > 0) {
    const convIds = conversations.map((c) => c.id);
    const { data: identities } = await supabase.rpc("resolve_chat_identities", {
      p_conversation_ids: convIds,
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

  const { data: directory } = await supabase.rpc("get_org_directory", {
    p_org_id: staff.activeOrgId
  });

  return (
    <div className="flex h-[calc(100dvh-8rem)] bg-zinc-900/30 rounded-xl border border-zinc-800 overflow-hidden">
      <ConversationList
        conversations={conversations}
        identityMap={identityMap}
        currentUserId={staff.user_id}
        directory={directory || []}
        organizationId={staff.activeOrgId}
      />
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/50">
        {children}
      </div>
    </div>
  );
}
