"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function sendMessage(conversationId: string, content: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("send_chat_message", {
    p_conv_id: conversationId,
    p_content: content,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/chat/${conversationId}`);
  return { success: true };
}

export async function createDM(organizationId: string, targetUserId: string) {
  const supabase = await createClient();

  const { data: convId, error } = await supabase.rpc("create_dm_conversation", {
    p_org_id: organizationId,
    p_target_user_id: targetUserId,
  });

  if (error || !convId) {
    return { error: error?.message || "Failed to create conversation" };
  }

  revalidatePath("/dashboard/chat");
  redirect(`/dashboard/chat/${convId}`);
}
