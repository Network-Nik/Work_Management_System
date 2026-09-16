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

export async function addAllowlistEmail(email: string) {
  const admin = await requireApprovedStaff();
  if (admin.role !== 'admin') {
    throw new Error("Unauthorized");
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
    return { error: "Invalid email address format." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_staff_emails")
    .insert({
      email: trimmedEmail.toLowerCase(),
      added_by: admin.user_id,
    });

  if (error) {
    if (error.code === '23505') {
      return { error: "Email is already allowlisted." };
    }
    console.error("Failed to add allowlist email:", error);
    return { error: "Failed to add email to allowlist." };
  }

  revalidatePath("/dashboard/admin/allowlist");
  return { success: true };
}

export async function removeAllowlistEmail(email: string) {
  const admin = await requireApprovedStaff();
  if (admin.role !== 'admin') {
    throw new Error("Unauthorized");
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) return { error: "Email is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_staff_emails")
    .delete()
    .eq("email", trimmedEmail);

  if (error) {
    console.error("Failed to remove allowlist email:", error);
    return { error: "Failed to remove email from allowlist." };
  }

  revalidatePath("/dashboard/admin/allowlist");
  return { success: true };
}

export async function updateStaffRole(userId: string, role: string) {
  const admin = await requireApprovedStaff();
  if (admin.role !== 'admin') {
    throw new Error("Unauthorized");
  }

  if (!userId || typeof userId !== 'string') return { error: "Invalid user." };
  if (role !== 'admin' && role !== 'manager' && role !== 'employee') {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_staff_role", {
    target_user_id: userId,
    new_role: role as "admin" | "manager" | "employee",
  });

  if (error) {
    console.error("Failed to update role:", error);
    if (error.message.includes('last approved admin')) {
      return { error: "Cannot change the role of the last approved Admin." };
    }
    return { error: "Failed to update staff role." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}
