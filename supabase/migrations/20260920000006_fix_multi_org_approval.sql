BEGIN;

-- ============================================================
-- 4E-D HOTFIX 2: Fix Global Approval / Multi-Org Isolation
-- ============================================================
-- ROOT CAUSE: admin_approve_staff_member previously updated the
-- global staff_profiles.access_status. In a multi-org environment,
-- this meant an admin rejecting a user in Org A would globally lock
-- them out of Org B.
--
-- ARCHITECTURE CHANGE: 
-- organization_members.access_status is the ONLY authoritative state
-- for org access. The RPCs no longer touch staff_profiles.
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

    -- Update ONLY organization_members (authoritative state)
    UPDATE public.organization_members
    SET access_status = 'approved',
        approved_by = v_caller_id,
        approved_at = now()
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id
      AND access_status = 'pending';
END;
$$;

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

    -- Update ONLY organization_members (authoritative state)
    UPDATE public.organization_members
    SET access_status = 'rejected'
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id
      AND access_status = 'pending';
END;
$$;

COMMIT;

