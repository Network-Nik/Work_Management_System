import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ApprovedStaff = {
  user_id: string;
  email: string;
  whatsapp_number: string | null;
  whatsapp_status: "pending" | "verified" | "rejected";
  access_status: "pending" | "approved" | "rejected";
  role: "admin" | "manager" | "employee";
  approved_by: string | null;
  approved_at: string | null;
  activeOrgId: string;
  isOwner: boolean;
};

/**
 * Resolves the active organization context for the authenticated user.
 * V1 Behavior: If exactly 1 approved org, returns it. If > 1, throws explicit context error. If 0, throws unauthorized.
 */
export async function resolveActiveOrganization(supabase: any, userId: string): Promise<string> {
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("access_status", "approved");

  if (error || !memberships || memberships.length === 0) {
    throw new Error("Approved organization membership is required.");
  }
  if (memberships.length > 1) {
    throw new Error("Explicit organization context required. Multiple memberships found.");
  }
  return memberships[0].organization_id;
}

/**
 * Ensures the current user is authenticated and has an approved staff profile.
 * Redirects to /login or /pending if not.
 * Returns the staff profile data with active organization context.
 */
export async function requireApprovedStaff(): Promise<ApprovedStaff> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select(
      "user_id, email, whatsapp_number, whatsapp_status, access_status, role, approved_by, approved_at",
    )
    .eq("user_id", user.id)
    .eq("access_status", "approved")
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("Approved staff access is required.");
  }

  const activeOrgId = await resolveActiveOrganization(supabase, user.id);

  // Determine ownership for the active organization
  const { data: ownerRecord } = await supabase
    .from("organization_owners")
    .select("user_id")
    .eq("organization_id", activeOrgId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isOwner = !!ownerRecord;

  return { ...profile, activeOrgId, isOwner } as ApprovedStaff;
}