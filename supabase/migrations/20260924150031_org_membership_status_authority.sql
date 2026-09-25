-- Supabase CLI often wraps migrations in a transaction.
-- We must COMMIT that implicit transaction to safely execute ALTER TYPE ADD VALUE.
COMMIT;

ALTER TYPE public.staff_access_status ADD VALUE IF NOT EXISTS 'revoked';

-- Re-open a transaction for the remaining safe DDL and function updates
BEGIN;

-- 1. Fix organization_members_approval_metadata to support revoked state
ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_approval_metadata;

ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_approval_metadata
CHECK (
  (access_status IN ('approved', 'revoked') AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  OR (access_status NOT IN ('approved', 'revoked') AND approved_by IS NULL AND approved_at IS NULL)
);

-- 2. Fix get_org_staff_profiles to use organization_members authority
CREATE OR REPLACE FUNCTION public.get_org_staff_profiles(
    p_org_id uuid,
    p_access_status staff_access_status
)
RETURNS TABLE (
    user_id uuid,
    email citext,
    whatsapp_number text,
    role staff_role,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Owner access required';
    END IF;

    RETURN QUERY
    SELECT sp.user_id, sp.email, sp.whatsapp_number, om.role, sp.created_at
    FROM public.staff_profiles sp
    JOIN public.organization_members om
      ON om.user_id = sp.user_id
     AND om.organization_id = p_org_id
    WHERE om.access_status = p_access_status
    ORDER BY sp.created_at ASC;
END;
$$;

-- 3. Fix admin_approve_staff_member to stop modifying global staff_profiles
CREATE OR REPLACE FUNCTION public.admin_approve_staff_member(p_target_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Owner access required';
    END IF;

    UPDATE public.organization_members
    SET access_status = 'approved',
        approved_by = v_caller_id,
        approved_at = now()
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id
      AND access_status = 'pending';
END;
$$;

-- 4. Fix admin_reject_staff_member to stop modifying global staff_profiles
CREATE OR REPLACE FUNCTION public.admin_reject_staff_member(p_target_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Owner access required';
    END IF;

    UPDATE public.organization_members
    SET access_status = 'rejected'
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id
      AND access_status = 'pending';
END;
$$;

COMMIT;

