-- Migration: admin_bootstrap
-- Description: Creates a secure, concurrency-safe RPC for bootstrapping the first admin user in development environments.

-- 1. Helper RPC to check if any admin exists
CREATE OR REPLACE FUNCTION public.has_system_admins()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles WHERE is_admin = true
  );
$$;

-- Secure the helper RPC
REVOKE ALL ON FUNCTION public.has_system_admins() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_system_admins() TO authenticated;

-- 2. Bootstrap RPC
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(whatsapp_num text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    admin_count int;
    user_email text;
BEGIN
    -- Ensure caller is an authenticated user
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate WhatsApp number against the exact existing E.164 format constraint
    IF whatsapp_num IS NULL OR NOT (whatsapp_num ~ '^\+[1-9][0-9]{7,14}$') THEN
        RAISE EXCEPTION 'Invalid WhatsApp number format. Must be E.164 (e.g. +1234567890).';
    END IF;

    -- Concurrency Control: Serialize access to this operation
    -- EXCLUSIVE MODE prevents concurrent writes but allows concurrent SELECTs.
    LOCK TABLE public.staff_profiles IN EXCLUSIVE MODE;

    -- THE LOCK: Check if ANY admin already exists
    SELECT count(*) INTO admin_count FROM public.staff_profiles WHERE is_admin = true;
    
    -- Note: This lock disengages if the only admin is ever deleted, 
    -- making the bootstrap available again for a new admin.
    IF admin_count > 0 THEN
        RAISE EXCEPTION 'An admin already exists. Bootstrapping is currently disabled.';
    END IF;

    -- Extract secure email from JWT
    user_email := lower(auth.jwt() ->> 'email');

    -- Inject into allowlist (bypassing RLS as function owner)
    INSERT INTO public.approved_staff_emails (email, added_by)
    VALUES (user_email, auth.uid())
    ON CONFLICT (email) DO NOTHING;

    -- Create the self-approved Admin profile
    INSERT INTO public.staff_profiles (
        user_id, 
        email, 
        whatsapp_number, 
        whatsapp_status, 
        access_status, 
        is_admin, 
        approved_by, 
        approved_at
    )
    VALUES (
        auth.uid(), 
        user_email, 
        whatsapp_num, 
        'verified', 
        'approved', 
        true, 
        auth.uid(), -- Self-approval for the root admin
        now()
    );
END;
$$;

-- Secure execution grants
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(text) TO authenticated;

