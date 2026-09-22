"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NewDmModal } from "./new-dm-modal";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  type: "direct" | "department";
  department_id: string | null;
  dm_identifier: string | null;
  is_active: boolean;
  last_message_at: string;
  departments?: { name: string } | null;
  chat_conversation_members?: { user_id: string }[];
  isUnread?: boolean;
  latestMessage?: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
};

type Props = {
  conversations: Conversation[];
  identityMap: Record<string, { display_name: string; username: string }>;
  currentUserId: string;
  directory: { user_id: string; display_name: string; username: string; job_title: string }[];
  organizationId: string;
};

function formatTimestamp(isoString: string) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const isSameYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (isYesterday) {
    return "Yesterday";
  } else if (isSameYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  }
}

export function ConversationList({ conversations, identityMap, currentUserId, directory, organizationId }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [localConversations, setLocalConversations] = useState<Conversation[]>(conversations);
  const pathnameRef = useRef(pathname);
  const hasConnected = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Sync with server props whenever they update
  useEffect(() => {
    setLocalConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    let isUnmounting = false;
    const supabase = createClient();
    const channel = supabase
      .channel("chat-global-sidebar")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new;
          const currentPath = pathnameRef.current;

          setLocalConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === newMsg.conversation_id);
            if (idx === -1) {
              // A completely new conversation arrived (e.g. new DM)
              router.refresh();
              return prev;
            }

            const updated = [...prev];
            const conv = { ...updated[idx] };

            conv.latestMessage = {
              content: newMsg.content,
              created_at: newMsg.created_at,
              sender_id: newMsg.sender_id,
            };
            conv.last_message_at = newMsg.created_at;

            // Only mark unread if we are not actively viewing this conversation
            if (currentPath !== `/dashboard/chat/${conv.id}`) {
              conv.isUnread = true;
            }

            updated[idx] = conv;

            // Re-sort so the updated conversation bubbles to the top
            return updated.sort(
              (a, b) =>
                new Date(b.last_message_at || 0).getTime() -
                new Date(a.last_message_at || 0).getTime()
            );
          });
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          if (hasConnected.current) {
            router.refresh();
          } else {
            hasConnected.current = true;
          }
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Global sidebar channel error:", err);
        } else if (status === "TIMED_OUT") {
          console.warn("[Realtime] Global sidebar channel timed out:", err);
        } else if (status === "CLOSED") {
          if (!isUnmounting) {
            console.warn("[Realtime] Global sidebar channel closed unexpectedly. Recovering...");
            channel.subscribe();
          }
        }
      });

    return () => {
      isUnmounting = true;
      supabase.removeChannel(channel);
    };
  }, [router]);

  const depts = localConversations.filter(c => c.type === "department");
  const dms = localConversations.filter(c => c.type === "direct");

  return (
    <div className={`w-full lg:w-72 flex flex-col border-r border-zinc-800 bg-zinc-950/80 ${pathname === "/dashboard/chat" ? "flex" : "hidden lg:flex"}`}>
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <h2 className="font-medium text-zinc-100">Conversations</h2>
        <NewDmModal directory={directory} organizationId={organizationId} currentUserId={currentUserId} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {depts.length > 0 && (
          <div>
            <h3 className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Departments</h3>
            <div className="space-y-1">
              {depts.map(dept => {
                const isActive = pathname === `/dashboard/chat/${dept.id}`;
                const nameClasses = dept.isUnread ? "font-semibold text-zinc-100" : (isActive ? "text-zinc-100" : "text-zinc-400");

                return (
                  <Link
                    key={dept.id}
                    href={`/dashboard/chat/${dept.id}`}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {dept.isUnread && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                        <span className={`truncate ${nameClasses}`}>
                          <span className="opacity-50 mr-1">#</span>
                          {dept.departments?.name}
                        </span>
                        {!dept.is_active && <span className="ml-1 text-[10px] uppercase border border-zinc-700 px-1 py-0.5 rounded text-zinc-500 shrink-0">Archived</span>}
                      </div>
                      {dept.latestMessage && (
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                          {formatTimestamp(dept.latestMessage.created_at)}
                        </span>
                      )}
                    </div>
                    {dept.latestMessage ? (
                      <div className="text-xs text-zinc-500 truncate pl-3">
                        {identityMap[dept.latestMessage.sender_id]?.display_name?.split(' ')[0] || "Unknown User"}: {dept.latestMessage.content}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-600 italic pl-3">No messages yet</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {dms.length > 0 && (
          <div>
            <h3 className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Direct Messages</h3>
            <div className="space-y-1">
              {dms.map(dm => {
                const otherMember = dm.chat_conversation_members?.find(m => m.user_id !== currentUserId);
                const identity = otherMember ? identityMap[otherMember.user_id] : null;
                const name = identity ? identity.display_name || identity.username : "Unknown User";
                const isActive = pathname === `/dashboard/chat/${dm.id}`;
                const nameClasses = dm.isUnread ? "font-semibold text-zinc-100" : (isActive ? "text-zinc-100" : "text-zinc-400");

                return (
                  <Link
                    key={dm.id}
                    href={`/dashboard/chat/${dm.id}`}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center min-w-0">
                        {dm.isUnread && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mr-1.5" />}
                        <div className="w-5 h-5 rounded bg-zinc-800 mr-2 flex items-center justify-center text-[10px] text-zinc-500 font-medium border border-zinc-700 shrink-0">
                          {name.substring(0, 1).toUpperCase()}
                        </div>
                        <span className={`truncate ${nameClasses}`}>{name}</span>
                      </div>
                      {dm.latestMessage && (
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                          {formatTimestamp(dm.latestMessage.created_at)}
                        </span>
                      )}
                    </div>
                    {dm.latestMessage ? (
                      <div className="text-xs text-zinc-500 truncate pl-[34px]">
                        {dm.latestMessage.sender_id === currentUserId ? 'You: ' : ''}{dm.latestMessage.content}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-600 italic pl-[34px]">No messages yet</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
