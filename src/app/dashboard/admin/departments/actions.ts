"use server";

import { createClient } from "@/lib/supabase/server";
import { requireApprovedStaff } from "@/lib/auth/require-approved-staff";
import { revalidatePath } from "next/cache";

export async function saveDepartment(formData: FormData) {
  const staff = await requireApprovedStaff();
  
  if (staff.role !== 'admin') {
    throw new Error("Unauthorized: Only Admins can manage departments.");
  }

  const id = formData.get("id") as string | null;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const is_active = formData.get("is_active") === "true";

  if (!name?.trim()) {
    return { error: "Department name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_department", {
    p_org_id: staff.activeOrgId,
    p_dept_id: id || undefined,
    p_name: name.trim(),
    p_description: description?.trim() || undefined,
    p_is_active: is_active,
  });

  if (error) {
    console.error("Failed to manage department:", error);
    if (error.message.includes("unique_org_name")) {
      return { error: "A department with this name already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/departments");
  return { success: true };
}
