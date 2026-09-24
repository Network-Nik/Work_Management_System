"use server";

import { createClient } from "@/lib/supabase/server";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { revalidatePath } from "next/cache";
import { WorkPulseStatus } from "@/types/work-pulse";

export async function createWorkPulse(expectedOrgId: string, title: string, description?: string, estimatedEndAt?: string) {
  try {
    const staff = await requireApprovedStaff();
    if (staff.activeOrgId !== expectedOrgId) {
      return { error: "WORKSPACE_CONTEXT_CONFLICT" };
    }
    
    if (!title || title.trim().length === 0) {
      return { error: "Title is required" };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("work_pulse_entries").insert({
      organization_id: staff.activeOrgId,
      user_id: staff.user_id,
      title: title.trim(),
      description: description?.trim() || null,
      estimated_end_at: estimatedEndAt || null,
    });

    if (error) {
      console.error("Failed to create work pulse:", error);
      return { error: "Failed to create work pulse entry" };
    }

    revalidatePath("/dashboard/work-pulse");
    return { success: true };
  } catch (err) {
    console.error("Exception in createWorkPulse:", err);
    return { error: "An unexpected error occurred" };
  }
}

export async function updateWorkPulse(id: string, title: string, description: string | null, status: WorkPulseStatus, estimatedEndAt: string | null) {
  try {
    await requireApprovedStaff(); // verifies authentication and active org
    
    if (!title || title.trim().length === 0) {
      return { error: "Title is required" };
    }
    
    if (!["in_progress", "blocked", "completed"].includes(status)) {
      return { error: "Invalid work pulse status" };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("update_work_pulse_entry", {
      p_entry_id: id,
      p_title: title.trim(),
      p_description: (description?.trim() || null) as unknown as string,
      p_status: status,
      p_estimated_end_at: (estimatedEndAt || null) as unknown as string,
    });

    if (error) {
      console.error("Failed to update work pulse:", error);
      return { error: "Failed to update work pulse entry" };
    }

    revalidatePath("/dashboard/work-pulse");
    return { success: true };
  } catch (err) {
    console.error("Exception in updateWorkPulse:", err);
    return { error: "An unexpected error occurred" };
  }
}

export async function updateMyAvailability(expectedOrgId: string, availability: string) {
  try {
    const staff = await requireApprovedStaff();
    if (staff.activeOrgId !== expectedOrgId) {
      return { error: "WORKSPACE_CONTEXT_CONFLICT" };
    }
    
    const validStatuses = ["available", "busy", "focused", "away"];
    if (!validStatuses.includes(availability)) {
      return { error: "Invalid availability status" };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("update_my_availability", {
      p_org_id: staff.activeOrgId,
      p_availability: availability,
    });

    if (error) {
      console.error("Failed to update availability:", error);
      return { error: "Failed to update availability" };
    }

    // Since availability is globally useful, we might want to revalidate dashboard too, but instructions explicitly mentioned "/dashboard/work-pulse".
    // I will revalidate "/dashboard/work-pulse".
    revalidatePath("/dashboard/work-pulse");
    return { success: true };
  } catch (err) {
    console.error("Exception in updateMyAvailability:", err);
    return { error: "An unexpected error occurred" };
  }
}
