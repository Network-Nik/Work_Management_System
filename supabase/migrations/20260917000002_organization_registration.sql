-- Migration: organization_registration
-- Description: Adds the secure RPC for multi-org registration.

BEGIN;

CREATE OR REPLACE FUNCTION public.register_staff_profile(p_whatsapp_number text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id uuid;
    v_email citext;
BEGIN
    v_user_id := auth.uid();
    v_email := lower(auth.jwt() ->> 'email')::citext;
    
    IF v_user_id IS NULL OR v_email IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.approved_staff_emails WHERE email = v_email) THEN
        RAISE EXCEPTION 'Email is not allowlisted';
    END IF;

    -- 1. Insert global profile
    INSERT INTO public.staff_profiles (user_id, email, whatsapp_number, access_status, role)
    VALUES (v_user_id, v_email, NULLIF(trim(p_whatsapp_number), ''), 'pending', 'employee');

    -- 2. Insert pending memberships for every org where email is allowlisted
    INSERT INTO public.organization_members (organization_id, user_id, role, access_status)
    SELECT organization_id, v_user_id, 'employee', 'pending'
    FROM public.approved_staff_emails
    WHERE email = v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.register_staff_profile(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_staff_profile(text) TO authenticated;

COMMIT;

