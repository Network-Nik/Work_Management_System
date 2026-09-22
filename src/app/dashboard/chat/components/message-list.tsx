"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markAsRead } from "../actions";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Props = {
  conversationId: string;
  isUnread: boolean;
  messages: Message[];
  identityMap: Record<string, { display_name: string; username: string }>;
  currentUserId: string;
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

export function MessageList({ conversationId, isUnread, messages, identityMap, currentUserId }: Props) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasConnected = useRef(false);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);

  useEffect(() => {
    // Clear realtime messages that have now been provided by the server
    const serverIds = new Set(messages.map((m) => m.id));
    setRealtimeMessages((prev) => prev.filter((m) => !serverIds.has(m.id)));
  }, [messages]);

  useEffect(() => {
    let isUnmounting = false;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-active-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setRealtimeMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev]; // newer messages first in realtime buffer
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
          console.error("[Realtime] Active channel error:", err);
        } else if (status === "TIMED_OUT") {
          console.warn("[Realtime] Active channel timed out:", err);
        } else if (status === "CLOSED") {
          if (!isUnmounting) {
            console.warn("[Realtime] Active channel closed unexpectedly. Recovering...");
            channel.subscribe();
          }
        }
      });

    return () => {
      isUnmounting = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  // messages from server are ordered by created_at desc (newest first).
  // realtimeMessages are also newest first.
  const allMessages = [...realtimeMessages, ...messages];
  const orderedMessages = [...allMessages].reverse(); // reverse for chronological display

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]); // scroll down on any new message

  useEffect(() => {
    if (!isUnread) return;

    let ignore = false;

    const doMark = async () => {
      // Small delay allows React Strict Mode's unmount to run first
      await new Promise((r) => setTimeout(r, 50));
      if (!ignore) {
        await markAsRead(conversationId).catch(() => {});
      }
    };

    doMark();

    return () => {
      ignore = true;
    };
  }, [conversationId, isUnread]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950/50">
      {orderedMessages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
          No messages yet. Send a message to start the conversation.
        </div>
      ) : (
        <div className="space-y-6">
          {orderedMessages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            const identity = identityMap[msg.sender_id];
            const name = identity ? identity.display_name || identity.username : "Unknown User";

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className="flex items-baseline space-x-2 mb-1">
                  <span className="text-xs font-medium text-zinc-300">{isMe ? "You" : name}</span>
                  <span className="text-[10px] text-zinc-500">
                    {formatTimestamp(msg.created_at)}
                  </span>
                </div>
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[85%] sm:max-w-[75%] text-sm whitespace-pre-wrap ${
                    isMe
                      ? "bg-indigo-600 text-indigo-50 rounded-tr-sm"
                      : "bg-zinc-800 text-zinc-200 rounded-tl-sm border border-zinc-700/50"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
