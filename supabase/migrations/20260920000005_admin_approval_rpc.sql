BEGIN;

-- ============================================================
-- 4E-D HOTFIX: Secure Admin Approval Flow
-- ============================================================
-- The legacy staff_profiles updates in approveStaff/rejectStaff
-- fail because staff_profiles UPDATE RLS is self-only.
-- These SECURITY DEFINER RPCs provide a secure, org-scoped way
-- for Admins to approve/reject staff across both tables.
-- ============================================================

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

    -- 1. Update organization_members
    UPDATE public.organization_members
    SET access_status = 'approved',
        approved_by = v_caller_id,
        approved_at = now()
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id
      AND access_status = 'pending';

    -- 2. Update staff_profiles (legacy sync)
    UPDATE public.staff_profiles
    SET access_status = 'approved',
        approved_by = v_caller_id,
        approved_at = now()
    WHERE user_id = p_target_user_id
      AND access_status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_staff_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_staff_member(uuid, uuid) TO authenticated;

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

    -- 1. Update organization_members
    UPDATE public.organization_members
    SET access_status = 'rejected'
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id
      AND access_status = 'pending';

    -- 2. Update staff_profiles (legacy sync)
    UPDATE public.staff_profiles
    SET access_status = 'rejected'
    WHERE user_id = p_target_user_id
      AND access_status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_staff_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_staff_member(uuid, uuid) TO authenticated;

COMMIT;

