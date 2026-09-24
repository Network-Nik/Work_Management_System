import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export type BaseStaffProfile = {
  user_id: string;
  email: string;
  whatsapp_number: string | null;
  whatsapp_status: "pending" | "verified" | "rejected";
  access_status: "pending" | "approved" | "rejected";
  role: "admin" | "manager" | "employee";
  approved_by: string | null;
  approved_at: string | null;
  memberships: Array<{
    organization_id: string;
    organizations: { name: string } | null;
  }>;
};

export type ApprovedStaff = BaseStaffProfile & {
  activeOrgId: string;
  isOwner: boolean;
  display_name: string | null;
  username: string | null;
  job_title: string | null;
  department_id: string | null;
  availability: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Ensures the current user is authenticated and has a staff profile.
 * Does NOT require an active workspace context.
 * Useful for workspace selection flows.
 */
export async function requireStaffProfile(): Promise<BaseStaffProfile> {
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
      "user_id, email, whatsapp_number, whatsapp_status, access_status, role, approved_by, approved_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/register");
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .eq("access_status", "approved");

  // Type assertion for PostgREST joined arrays
  type MembershipRow = {
    organization_id: string;
    organizations: { name: string } | { name: string }[] | null;
  };
  const formattedMemberships = (memberships || []).map((m: MembershipRow) => ({
    organization_id: m.organization_id,
    organizations: Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
  }));

  return {
    ...profile,
    memberships: formattedMemberships,
  } as BaseStaffProfile;
}

/**
 * Resolves the active organization context for the authenticated user.
 * Redirects to /workspace-selection if no valid context exists.
 */
export async function requireApprovedStaff(): Promise<ApprovedStaff> {
  const profile = await requireStaffProfile();

  if (!profile.memberships || profile.memberships.length === 0) {
    redirect("/pending");
  }

  const cookieStore = await cookies();
  const workspaceCookie = cookieStore.get("agy_workspace_id");
  let activeOrgId: string | null = null;

  if (workspaceCookie && UUID_REGEX.test(workspaceCookie.value)) {
    const isValid = profile.memberships.some(m => m.organization_id === workspaceCookie.value);
    if (isValid) {
      activeOrgId = workspaceCookie.value;
    }
  }

  if (!activeOrgId) {
    redirect("/workspace-selection");
  }

  const supabase = await createClient();

  // Fetch the organization-scoped profile fields
  const { data: orgProfile } = await supabase
    .from("organization_members")
    .select("display_name, username, job_title, department_id, availability")
    .eq("organization_id", activeOrgId)
    .eq("user_id", profile.user_id)
    .single();

  // Determine ownership for the active organization
  const { data: ownerRecord } = await supabase
    .from("organization_owners")
    .select("user_id")
    .eq("organization_id", activeOrgId)
    .eq("user_id", profile.user_id)
    .maybeSingle();

  const isOwner = !!ownerRecord;

  return {
    ...profile,
    activeOrgId,
    isOwner,
    display_name: orgProfile?.display_name ?? null,
    username: orgProfile?.username ?? null,
    job_title: orgProfile?.job_title ?? null,
    department_id: orgProfile?.department_id ?? null,
    availability: orgProfile?.availability ?? 'available',
  } as ApprovedStaff;
}
