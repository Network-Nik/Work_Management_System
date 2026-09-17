BEGIN;

-- 1. FIX UPDATE_SELF_PROFILE to strictly enforce Employee role
CREATE OR REPLACE FUNCTION public.update_self_profile(
    p_org_id uuid,
    p_display_name text,
    p_username text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    SELECT role INTO v_role FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid();
    
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;

    IF v_role = 'manager' THEN
        RAISE EXCEPTION 'Managers cannot edit their own profiles in V1';
    END IF;

    IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
        RAISE EXCEPTION 'Display name is required';
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username is required';
    END IF;

    UPDATE public.organization_members
    SET display_name = trim(p_display_name),
        username = lower(trim(p_username)),
        updated_at = timezone('utc', now())
    WHERE organization_id = p_org_id AND user_id = auth.uid();
END;
$$;

-- 2. FIX ADMIN_UPDATE_MEMBER_PROFILE to use JSONB patch semantics
DROP FUNCTION IF EXISTS public.admin_update_member_profile(uuid, uuid, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.admin_update_member_profile(
    p_org_id uuid,
    p_target_user_id uuid,
    p_updates jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_current_dept uuid;
    v_dept_active boolean;
    v_target_dept uuid;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT public.is_org_admin(p_org_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id) THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;

    IF p_updates ? 'display_name' THEN
        IF p_updates->>'display_name' IS NULL OR trim(p_updates->>'display_name') = '' THEN
            RAISE EXCEPTION 'Display name cannot be empty';
        END IF;
    END IF;

    IF p_updates ? 'username' THEN
        IF p_updates->>'username' IS NULL OR trim(p_updates->>'username') = '' THEN
            RAISE EXCEPTION 'Username cannot be empty';
        END IF;
    END IF;

    IF p_updates ? 'department_id' THEN
        IF p_updates->>'department_id' IS NOT NULL THEN
            v_target_dept := (p_updates->>'department_id')::uuid;
            SELECT is_active INTO v_dept_active FROM public.departments WHERE id = v_target_dept AND organization_id = p_org_id;
            IF v_dept_active IS NULL THEN
                RAISE EXCEPTION 'Department does not exist';
            END IF;
            
            IF NOT v_dept_active THEN
                SELECT department_id INTO v_current_dept FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id;
                IF v_current_dept IS DISTINCT FROM v_target_dept THEN
                    RAISE EXCEPTION 'Cannot assign member to an archived department';
                END IF;
            END IF;
        END IF;
    END IF;

    UPDATE public.organization_members
    SET 
        display_name = CASE WHEN p_updates ? 'display_name' THEN trim(p_updates->>'display_name') ELSE display_name END,
        username = CASE WHEN p_updates ? 'username' THEN lower(trim(p_updates->>'username')) ELSE username END,
        job_title = CASE 
            WHEN p_updates ? 'job_title' THEN 
                CASE WHEN p_updates->>'job_title' IS NULL OR trim(p_updates->>'job_title') = '' THEN NULL ELSE trim(p_updates->>'job_title') END
            ELSE job_title 
        END,
        department_id = CASE WHEN p_updates ? 'department_id' THEN (p_updates->>'department_id')::uuid ELSE department_id END,
        updated_at = timezone('utc', now())
    WHERE organization_id = p_org_id AND user_id = p_target_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_member_profile TO authenticated;

COMMIT;

