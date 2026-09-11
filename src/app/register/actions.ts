"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RegisterFormState = {
  error?: string;
};

/**
 * Validates and normalizes an international phone number to E.164 format.
 * E.164 format: + followed by 1-9, then 7 to 14 digits (total 8 to 15 digits).
 * Matches the PostgreSQL constraint: '^\+[1-9][0-9]{7,14}$'
 */
function normalizeAndValidateWhatsapp(rawNumber: string): {
  isValid: boolean;
  normalized: string;
} {
  // Strip whitespace, hyphens, parentheses, and dots
  const stripped = rawNumber.trim().replace(/[\s\-.()]/g, "");

  // Must match E.164 format
  const e164Regex = /^\+[1-9][0-9]{7,14}$/;
  if (!e164Regex.test(stripped)) {
    return { isValid: false, normalized: stripped };
  }

  return { isValid: true, normalized: stripped };
}

export async function registerStaffProfile(
  _previousState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const supabase = await createClient();

  // 1. Authenticate user from server session (never trust client)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    return { error: "Authentication is required. Please sign in again." };
  }

  // 2. Verify email allowlist via the secure SECURITY DEFINER RPC
  const { data: isAllowlisted, error: rpcError } = await supabase.rpc(
    "is_approved_staff_email",
  );

  if (rpcError || !isAllowlisted) {
    return {
      error:
        "Your email address is not on the approved staff allowlist. Access cannot be granted.",
    };
  }

  // 3. Check if a profile already exists for this user
  const { data: existingProfile } = await supabase
    .from("staff_profiles")
    .select("access_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.access_status === "approved") {
      redirect("/dashboard");
    }
    // For pending or rejected, send to the pending/status page
    redirect("/pending");
  }

  // 4. Validate WhatsApp number
  const rawWhatsapp = formData.get("whatsapp_number");
  if (typeof rawWhatsapp !== "string" || !rawWhatsapp.trim()) {
    return {
      error: "WhatsApp number is required.",
    };
  }

  const { isValid, normalized } = normalizeAndValidateWhatsapp(rawWhatsapp);
  if (!isValid) {
    return {
      error:
        "Please enter a valid WhatsApp number in international E.164 format (e.g. +94771234567).",
    };
  }

  // 5. Insert staff profile using existing schema & RLS policies
  const userEmail = user.email.toLowerCase().trim();

  const { error: insertError } = await supabase.from("staff_profiles").insert({
    user_id: user.id,
    email: userEmail,
    whatsapp_number: normalized,
    access_status: "pending",
    whatsapp_status: "pending",
    is_admin: false,
    approved_by: null,
    approved_at: null,
  });

  if (insertError) {
    // Unique violation (error code 23505)
    if (insertError.code === "23505") {
      const message = insertError.message.toLowerCase();
      if (message.includes("whatsapp_number")) {
        return {
          error:
            "This WhatsApp number is already registered with another account.",
        };
      }
      if (message.includes("email") || message.includes("user_id")) {
        redirect("/pending");
      }
    }

    // Check constraint violation (error code 23514)
    if (insertError.code === "23514") {
      return {
        error:
          "Invalid WhatsApp number format. Please ensure it begins with a country code (e.g. +94771234567).",
      };
    }

    // RLS or permission error (error code 42501)
    if (insertError.code === "42501") {
      return {
        error:
          "Registration rejected by security policy. Your email may not be on the approved allowlist.",
      };
    }

    return {
      error:
        "Failed to submit your registration. Please try again or contact support.",
    };
  }

  // 6. Redirect to /pending on success
  redirect("/pending");
}

