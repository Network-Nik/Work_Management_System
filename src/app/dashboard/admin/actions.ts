"use server";

import { createClient } from "@/lib/supabase/server";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { revalidatePath } from "next/cache";

export async function approveStaff(userId: string) {
  const admin = await requireApprovedStaff();
  if (admin.role !== 'admin') {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_profiles")
    .update({
      access_status: "approved",
      approved_by: admin.user_id,
      approved_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("access_status", "pending"); // Only approve pending

  if (error) {
    console.error("Failed to approve staff:", error);
    return { error: "Failed to approve staff member" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function rejectStaff(userId: string) {
  const admin = await requireApprovedStaff();
  if (admin.role !== 'admin') {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_profiles")
    .update({
      access_status: "rejected",
    })
    .eq("user_id", userId)
    .eq("access_status", "pending"); // Only reject pending

  if (error) {
    console.error("Failed to reject staff:", error);
    return { error: "Failed to reject staff member" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

