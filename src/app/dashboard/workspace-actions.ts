"use server";

import { requireStaffProfile } from "@/lib/auth/require-approved-staff";
import { cookies } from "next/headers";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function switchWorkspaceAction(orgId: string) {
  if (!UUID_REGEX.test(orgId)) {
    return { error: "Invalid organization ID" };
  }

  // Authoritative validation
  const profile = await requireStaffProfile();
  const isValid = profile.memberships.some((m) => m.organization_id === orgId);

  if (!isValid) {
    return { error: "Unauthorized workspace" };
  }

  const cookieStore = await cookies();
  cookieStore.set("agy_workspace_id", orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Session cookie (omitting maxAge/expires so it lasts for the browser session)
  });

  return { success: true };
}
