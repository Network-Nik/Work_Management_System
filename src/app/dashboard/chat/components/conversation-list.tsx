"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewDmModal } from "./new-dm-modal";

type Conversation = {
  id: string;
  type: "direct" | "department";
  department_id: string | null;
  dm_identifier: string | null;
  is_active: boolean;
  last_message_at: string;
  departments?: { name: string } | null;
  chat_conversation_members?: { user_id: string }[];
};

type Props = {
  conversations: Conversation[];
  identityMap: Record<string, { display_name: string; username: string }>;
  currentUserId: string;
  directory: { user_id: string; display_name: string; username: string; job_title: string }[];
  organizationId: string;
};

export function ConversationList({ conversations, identityMap, currentUserId, directory, organizationId }: Props) {
  const pathname = usePathname();

  const depts = conversations.filter(c => c.type === "department");
  const dms = conversations.filter(c => c.type === "direct");

  return (
    <div className={`w-full lg:w-72 flex flex-col border-r border-zinc-800 bg-zinc-950/80 ${pathname === "/dashboard/chat" ? "flex" : "hidden lg:flex"}`}>
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="font-medium text-zinc-100">Conversations</h2>
        <NewDmModal directory={directory} organizationId={organizationId} currentUserId={currentUserId} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {depts.length > 0 && (
          <div>
            <h3 className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Departments</h3>
            <div className="space-y-1">
              {depts.map(dept => (
                <Link
                  key={dept.id}
                  href={`/dashboard/chat/${dept.id}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${pathname === `/dashboard/chat/${dept.id}` ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
                >
                  <span className="opacity-50 mr-1.5">#</span>
                  {dept.departments?.name}
                  {!dept.is_active && <span className="ml-2 text-[10px] uppercase border border-zinc-700 px-1 py-0.5 rounded text-zinc-500">Archived</span>}
                </Link>
              ))}
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

                return (
                  <Link
                    key={dm.id}
                    href={`/dashboard/chat/${dm.id}`}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors flex items-center ${pathname === `/dashboard/chat/${dm.id}` ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
                  >
                    <div className="w-5 h-5 rounded bg-zinc-800 mr-2 flex items-center justify-center text-[10px] text-zinc-500 font-medium border border-zinc-700">
                      {name.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="truncate">{name}</span>
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
