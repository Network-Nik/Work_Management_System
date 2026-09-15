-- Migration: role_migration
-- Description: Migrates from boolean is_admin to formal staff_role enum.

-- 1. Create the enum
CREATE TYPE public.staff_role AS ENUM ('admin', 'manager', 'employee');

-- 2. Add the column with a safe default
ALTER TABLE public.staff_profiles 
  ADD COLUMN role public.staff_role NOT NULL DEFAULT 'employee';

-- 3. Migrate existing data (Preserve the bootstrapped Administrator)
UPDATE public.staff_profiles 
  SET role = 'admin' 
  WHERE is_admin = true;

-- 4. Update is_staff_admin()
CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_profiles
    WHERE user_id = auth.uid()
      AND access_status = 'approved'
      AND approved_by IS NOT NULL
      AND approved_at IS NOT NULL
      AND role = 'admin'
  );
$$;

-- 5. Update has_system_admins()
CREATE OR REPLACE FUNCTION public.has_system_admins()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles WHERE role = 'admin'
  );
$$;

-- 6. Update bootstrap_first_admin()
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF whatsapp_num IS NULL OR NOT (whatsapp_num ~ '^\+[1-9][0-9]{7,14}$') THEN
        RAISE EXCEPTION 'Invalid WhatsApp number format. Must be E.164 (e.g. +1234567890).';
    END IF;

    LOCK TABLE public.staff_profiles IN EXCLUSIVE MODE;

    SELECT count(*) INTO admin_count FROM public.staff_profiles WHERE role = 'admin';
    
    IF admin_count > 0 THEN
        RAISE EXCEPTION 'An admin already exists. Bootstrapping is currently disabled.';
    END IF;

    user_email := lower(auth.jwt() ->> 'email');

    INSERT INTO public.approved_staff_emails (email, added_by)
    VALUES (user_email, auth.uid())
    ON CONFLICT (email) DO NOTHING;

    INSERT INTO public.staff_profiles (
        user_id, 
        email, 
        whatsapp_number, 
        whatsapp_status, 
        access_status, 
        role, 
        approved_by, 
        approved_at
    )
    VALUES (
        auth.uid(), 
        user_email, 
        whatsapp_num, 
        'verified', 
        'approved', 
        'admin', 
        auth.uid(),
        now()
    );
END;
$$;

-- Secure grants for the updated functions
REVOKE ALL ON FUNCTION public.is_staff_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.has_system_admins() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_system_admins() TO authenticated;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(text) TO authenticated;

-- 7. Update affected RLS policies
DROP POLICY IF EXISTS "Allowlisted users can create a pending profile" ON public.staff_profiles;
CREATE POLICY "Allowlisted users can create a pending profile"
ON public.staff_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND email = lower((SELECT auth.jwt() ->> 'email'))::citext
  AND access_status = 'pending'
  AND role = 'employee'
  AND approved_by IS NULL
  AND approved_at IS NULL
  AND (SELECT public.is_approved_staff_email())
);

DROP POLICY IF EXISTS "Staff can update their registration details" ON public.staff_profiles;
CREATE POLICY "Staff can update their registration details"
ON public.staff_profiles
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND email = lower((SELECT auth.jwt() ->> 'email'))::citext
  AND access_status = 'pending'
  AND role = 'employee'
  AND approved_by IS NULL
  AND approved_at IS NULL
);

-- 8. Safely drop the is_admin column
ALTER TABLE public.staff_profiles 
  DROP COLUMN is_admin;
