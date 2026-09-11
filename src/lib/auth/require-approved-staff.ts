import { createClient } from "@/lib/supabase/server";

export type ApprovedStaff = {
  user_id: string;
  email: string;
  whatsapp_number: string | null;
  whatsapp_status: "pending" | "verified" | "rejected";
  access_status: "approved";
  is_admin: boolean;
  approved_by: string | null;
  approved_at: string | null;
};

export async function requireApprovedStaff(): Promise<ApprovedStaff> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication is required.");
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff_profiles")
    .select(
      "user_id, email, whatsapp_number, whatsapp_status, access_status, is_admin, approved_by, approved_at",
    )
    .eq("user_id", user.id)
    .eq("access_status", "approved")
    .maybeSingle();

  if (staffError || !staff) {
    throw new Error("Approved staff access is required.");
  }

  return staff as ApprovedStaff;
}