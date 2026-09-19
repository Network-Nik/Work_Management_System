"use server";

import { createClient } from "@/lib/supabase/server";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { revalidatePath } from "next/cache";

export async function adminEditMemberProfile(
  userId: string,
  updates: { display_name?: string; username?: string; job_title?: string | null; department_id?: string | null }
) {
  try {
    const admin = await requireApprovedStaff();
    if (admin.role !== 'admin' && !admin.isOwner) {
      return { error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_member_profile", {
      p_org_id: admin.activeOrgId,
      p_target_user_id: userId,
      p_updates: updates,
    });

    if (error) {
      console.error("Failed to update member profile:", error);
      if (error.message.includes("unique_org_username")) {
        return { error: "This username is already taken." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in adminEditMemberProfile:", err);
    return { error: "An unexpected error occurred." };
  }
}
