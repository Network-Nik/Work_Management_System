"use server";

import { createClient } from "@/lib/supabase/server";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { revalidatePath } from "next/cache";

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

// Helper for validating UUIDs
const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// Safe notification helper (does not crash the primary action)
async function sendNotification(
  supabase: SupabaseClient<Database>,
  recipient_id: string,
  actor_id: string,
  assignment_id: string,
  type: "assigned" | "accepted" | "declined" | "completed" | "cancelled" | "deadline_override"
) {
  try {
    const { error } = await supabase.from("in_app_notifications").insert({
      recipient_id,
      actor_id,
      assignment_id,
      type,
    });
    if (error) {
      console.error("Failed to insert notification:", error);
    }
  } catch (err) {
    console.error("Exception while sending notification:", err);
  }
}

export async function assignWork(formData: FormData) {
  try {
    const staff = await requireApprovedStaff();
    if (staff.role === "employee") {
      return { error: "Employees cannot assign work" };
    }

    const expectedOrgId = formData.get("expectedOrgId") as string;
    if (expectedOrgId && expectedOrgId !== staff.activeOrgId) {
      return { error: "WORKSPACE_CONTEXT_CONFLICT" };
    }

    const title = formData.get("title")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || null;
    const reference_id = formData.get("reference_id")?.toString().trim() || null;
    const assignee_id = formData.get("assignee_id")?.toString();
    const target_deadline = formData.get("target_deadline")?.toString() || null;

    if (!title) {
      return { error: "Title is required" };
    }
    if (!assignee_id || !isValidUUID(assignee_id)) {
      return { error: "Valid assignee is required" };
    }
    if (target_deadline && isNaN(Date.parse(target_deadline))) {
      return { error: "Invalid target deadline" };
    }

    const supabase = await createClient();

    // Create the assignment
    const { data: assignment, error } = await supabase
      .from("work_assignments")
      .insert({
        organization_id: staff.activeOrgId,
        title,
        description,
        reference_id,
        assignee_id,
        assigner_id: staff.user_id,
        target_deadline,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !assignment) {
      console.error("Failed to assign work:", error);
      return { error: "Failed to create work assignment" };
    }

    // Notify the assignee (unless it's a self-assignment)
    if (assignee_id !== staff.user_id) {
      await sendNotification(supabase, assignee_id, staff.user_id, assignment.id, "assigned");
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in assignWork:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function acceptWork(assignmentId: string, establishedDeadline: string) {
  try {
    const staff = await requireApprovedStaff();

    if (!assignmentId || !isValidUUID(assignmentId)) {
      return { error: "Invalid assignment ID" };
    }
    if (!establishedDeadline || isNaN(Date.parse(establishedDeadline))) {
      return { error: "Invalid established deadline" };
    }

    const supabase = await createClient();

    // Call RPC
    const { error: rpcError } = await supabase.rpc("accept_work", {
      p_id: assignmentId,
      p_established_deadline: establishedDeadline,
    });

    if (rpcError) {
      console.error("Failed to accept work:", rpcError);
      return { error: "Failed to accept work. Ensure it is pending." };
    }

    // Get assigner to notify them
    const { data: assignment } = await supabase
      .from("work_assignments")
      .select("assigner_id")
      .eq("id", assignmentId)
      .single();

    if (assignment && assignment.assigner_id !== staff.user_id) {
      await sendNotification(supabase, assignment.assigner_id, staff.user_id, assignmentId, "accepted");
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in acceptWork:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function declineWork(assignmentId: string, reason: string) {
  try {
    const staff = await requireApprovedStaff();

    const trimmedReason = reason?.trim();
    if (!assignmentId || !isValidUUID(assignmentId)) {
      return { error: "Invalid assignment ID" };
    }
    if (!trimmedReason) {
      return { error: "A reason is required to decline work" };
    }

    const supabase = await createClient();

    const { error: rpcError } = await supabase.rpc("decline_work", {
      p_id: assignmentId,
      p_reason: trimmedReason,
    });

    if (rpcError) {
      console.error("Failed to decline work:", rpcError);
      return { error: "Failed to decline work" };
    }

    const { data: assignment } = await supabase
      .from("work_assignments")
      .select("assigner_id")
      .eq("id", assignmentId)
      .single();

    if (assignment && assignment.assigner_id !== staff.user_id) {
      await sendNotification(supabase, assignment.assigner_id, staff.user_id, assignmentId, "declined");
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in declineWork:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function completeWork(assignmentId: string) {
  try {
    const staff = await requireApprovedStaff();

    if (!assignmentId || !isValidUUID(assignmentId)) {
      return { error: "Invalid assignment ID" };
    }

    const supabase = await createClient();

    // Look up the assignment first to know who to notify
    const { data: assignment } = await supabase
      .from("work_assignments")
      .select("assigner_id, assignee_id")
      .eq("id", assignmentId)
      .single();

    const { error: rpcError } = await supabase.rpc("complete_work", {
      p_id: assignmentId,
    });

    if (rpcError) {
      console.error("Failed to complete work:", rpcError);
      return { error: "Failed to complete work. You may not be authorized." };
    }

    if (assignment) {
      // Notify the other party
      const recipientId = assignment.assignee_id === staff.user_id ? assignment.assigner_id : assignment.assignee_id;
      if (recipientId !== staff.user_id) {
        await sendNotification(supabase, recipientId, staff.user_id, assignmentId, "completed");
      }
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in completeWork:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function cancelWork(assignmentId: string, reason: string) {
  try {
    const staff = await requireApprovedStaff();

    const trimmedReason = reason?.trim();
    if (!assignmentId || !isValidUUID(assignmentId)) {
      return { error: "Invalid assignment ID" };
    }
    if (!trimmedReason) {
      return { error: "A reason is required to cancel work" };
    }

    const supabase = await createClient();

    const { data: assignment } = await supabase
      .from("work_assignments")
      .select("assignee_id")
      .eq("id", assignmentId)
      .single();

    const { error: rpcError } = await supabase.rpc("cancel_work", {
      p_id: assignmentId,
      p_reason: trimmedReason,
    });

    if (rpcError) {
      console.error("Failed to cancel work:", rpcError);
      return { error: "Failed to cancel work" };
    }

    if (assignment && assignment.assignee_id !== staff.user_id) {
      await sendNotification(supabase, assignment.assignee_id, staff.user_id, assignmentId, "cancelled");
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in cancelWork:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function overrideDeadline(assignmentId: string, newDeadline: string, reason: string) {
  try {
    const staff = await requireApprovedStaff();

    const trimmedReason = reason?.trim();
    if (!assignmentId || !isValidUUID(assignmentId)) {
      return { error: "Invalid assignment ID" };
    }
    if (!newDeadline || isNaN(Date.parse(newDeadline))) {
      return { error: "Invalid new deadline" };
    }
    if (!trimmedReason) {
      return { error: "A reason is required to override the deadline" };
    }

    const supabase = await createClient();

    const { data: assignment } = await supabase
      .from("work_assignments")
      .select("assignee_id")
      .eq("id", assignmentId)
      .single();

    const { error: rpcError } = await supabase.rpc("override_deadline", {
      p_id: assignmentId,
      p_new_deadline: newDeadline,
      p_reason: trimmedReason,
    });

    if (rpcError) {
      console.error("Failed to override deadline:", rpcError);
      return { error: "Failed to override deadline" };
    }

    if (assignment && assignment.assignee_id !== staff.user_id) {
      await sendNotification(supabase, assignment.assignee_id, staff.user_id, assignmentId, "deadline_override");
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in overrideDeadline:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    const staff = await requireApprovedStaff();
    if (!isValidUUID(id)) return { error: "Invalid notification ID" };

    const supabase = await createClient();

    // We only pass is_read. We don't pass recipient_id because RLS already ensures
    // the user can only update their own notifications.
    const { error } = await supabase
      .from("in_app_notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return { error: "Failed to mark notification as read" };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in markNotificationAsRead:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const staff = await requireApprovedStaff();
    const supabase = await createClient();

    // The update applies only to rows where the recipient_id matches auth.uid() due to RLS,
    // but to be explicit and safe we specify the condition here as well, and only target unread.
    const { error } = await supabase
      .from("in_app_notifications")
      .update({ is_read: true })
      .eq("recipient_id", staff.user_id)
      .eq("is_read", false);

    if (error) {
      console.error("Failed to mark all notifications as read:", error);
      return { error: "Failed to mark notifications as read" };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Exception in markAllNotificationsAsRead:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function postAssignmentComment(assignmentId: string, content: string) {
  try {
    const staff = await requireApprovedStaff();
    if (!staff) return { error: "Unauthorized" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("add_assignment_comment", {
      p_assignment_id: assignmentId,
      p_content: content,
    });

    if (error) {
      console.error("Failed to post comment:", error);
      return { error: error.message };
    }

    revalidatePath("/dashboard/assignments/" + assignmentId);
    return { success: true };
  } catch (error) {
    console.error("Exception in postAssignmentComment:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function getCompanyProgressAction(period: "7d" | "30d" | "1y") {
  try {
    const staff = await requireApprovedStaff();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_company_progress", {
      p_org_id: staff.activeOrgId,
      p_period: period,
    });

    if (error) {
      console.error("Failed to get company progress:", error);
      return { error: "Failed to get company progress data" };
    }

    return { data };
  } catch (error) {
    console.error("Exception in getCompanyProgressAction:", error);
    return { error: "An unexpected error occurred" };
  }
}
