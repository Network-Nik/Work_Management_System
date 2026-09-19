"use server";

import { createClient } from "@/lib/supabase/server";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function completeProfile(formData: FormData) {
  const staff = await requireApprovedStaff();
  const displayName = formData.get("display_name") as string;
  const username = formData.get("username") as string;

  if (!displayName?.trim() || !username?.trim()) {
    return { error: "Display Name and Username are required." };
  }

  const supabase = await createClient();
  
  if (staff.role === "admin" || staff.isOwner) {
    const { error } = await supabase.rpc("admin_update_member_profile", {
      p_org_id: staff.activeOrgId,
      p_target_user_id: staff.user_id,
      p_updates: {
        display_name: displayName.trim(),
        username: username.trim(),
      }
    });

    if (error) {
      console.error("Failed to update profile (admin):", error);
      if (error.message.includes("unique_org_username")) {
        return { error: "This username is already taken." };
      }
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.rpc("update_self_profile", {
      p_org_id: staff.activeOrgId,
      p_display_name: displayName.trim(),
      p_username: username.trim(),
    });

    if (error) {
      console.error("Failed to update profile (employee):", error);
      if (error.message.includes("unique_org_username")) {
        return { error: "This username is already taken." };
      }
      return { error: error.message };
    }
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
