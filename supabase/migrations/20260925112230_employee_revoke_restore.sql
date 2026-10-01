BEGIN;

-- 1. Create member audit action enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_audit_action') THEN
        CREATE TYPE public.member_audit_action AS ENUM ('revoked', 'restored');
    END IF;
END $$;

-- 2. Create organization member audit table
CREATE TABLE IF NOT EXISTS public.organization_member_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_user_id uuid NOT NULL REFERENCES public.staff_profiles(user_id) ON DELETE RESTRICT,
    actor_id uuid REFERENCES public.staff_profiles(user_id) ON DELETE SET NULL,
    action public.member_audit_action NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_member_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.organization_member_audit TO authenticated;

-- RLS: Admins and owners can view audit logs
CREATE POLICY "Member audit visible to admins" ON public.organization_member_audit
FOR SELECT TO authenticated
USING (public.is_org_admin(organization_id));

-- 3. Add revoked_by and revoked_at to organization_members for transient UI state
ALTER TABLE public.organization_members
ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.staff_profiles(user_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- 4. REVOKE RPC
CREATE OR REPLACE FUNCTION public.admin_revoke_staff_member(p_target_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid;
    v_is_owner boolean;
    v_status staff_access_status;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Owner access required';
    END IF;

    -- Verify target is approved
    SELECT access_status INTO v_status
    FROM public.organization_members
    WHERE user_id = p_target_user_id AND organization_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership not found';
    END IF;
    IF v_status != 'approved' THEN
        RAISE EXCEPTION 'Only approved members can be revoked';
    END IF;

    -- Owner protection
    SELECT EXISTS(
        SELECT 1 FROM public.organization_owners 
        WHERE organization_id = p_org_id AND user_id = p_target_user_id
    ) INTO v_is_owner;
    
    IF v_is_owner THEN
        RAISE EXCEPTION 'Cannot revoke an organization owner. Transfer ownership first.';
    END IF;

    -- Execute revocation
    UPDATE public.organization_members
    SET access_status = 'revoked',
        revoked_by = v_caller_id,
        revoked_at = now()
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id;

    -- Insert permanent audit event
    INSERT INTO public.organization_member_audit (organization_id, target_user_id, actor_id, action)
    VALUES (p_org_id, p_target_user_id, v_caller_id, 'revoked');
END;
$$
;
REVOKE ALL ON FUNCTION public.admin_revoke_staff_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_staff_member(uuid, uuid) TO authenticated;

-- 5. RESTORE / REHIRE RPC
CREATE OR REPLACE FUNCTION public.admin_restore_staff_member(p_target_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid;
    v_status staff_access_status;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Owner access required';
    END IF;

    SELECT access_status INTO v_status
    FROM public.organization_members
    WHERE user_id = p_target_user_id AND organization_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership not found';
    END IF;
    IF v_status != 'revoked' THEN
        RAISE EXCEPTION 'Only revoked members can be restored';
    END IF;

    -- Execute restoration
    UPDATE public.organization_members
    SET access_status = 'approved',
        revoked_by = NULL,
        revoked_at = NULL
    WHERE user_id = p_target_user_id
      AND organization_id = p_org_id;

    -- Insert permanent audit event
    INSERT INTO public.organization_member_audit (organization_id, target_user_id, actor_id, action)
    VALUES (p_org_id, p_target_user_id, v_caller_id, 'restored');
END;
$$
;
REVOKE ALL ON FUNCTION public.admin_restore_staff_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_staff_member(uuid, uuid) TO authenticated;

COMMIT;
