"use client";

import { useEffect, useRef } from "react";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Props = {
  messages: Message[];
  identityMap: Record<string, { display_name: string; username: string }>;
  currentUserId: string;
};

export function MessageList({ messages, identityMap, currentUserId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const orderedMessages = [...messages].reverse();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
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
