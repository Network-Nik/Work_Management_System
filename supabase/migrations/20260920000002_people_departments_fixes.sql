BEGIN;

-- 1. FIX UPDATE_MEMBER_PROFILE (Split into Self vs Admin)
DROP FUNCTION IF EXISTS public.update_member_profile(uuid, uuid, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.update_self_profile(
    p_org_id uuid,
    p_display_name text,
    p_username text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'User is not a member of this organization';
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
GRANT EXECUTE ON FUNCTION public.update_self_profile TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_member_profile(
    p_org_id uuid,
    p_target_user_id uuid,
    p_display_name text,
    p_username text,
    p_job_title text DEFAULT NULL,
    p_department_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_current_dept uuid;
    v_dept_active boolean;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT public.is_org_admin(p_org_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id) THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;

    IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
        RAISE EXCEPTION 'Display name is required';
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username is required';
    END IF;

    IF p_department_id IS NOT NULL THEN
        SELECT is_active INTO v_dept_active FROM public.departments WHERE id = p_department_id AND organization_id = p_org_id;
        IF v_dept_active IS NULL THEN
            RAISE EXCEPTION 'Department does not exist';
        END IF;
        
        IF NOT v_dept_active THEN
            SELECT department_id INTO v_current_dept FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id;
            IF v_current_dept IS DISTINCT FROM p_department_id THEN
                RAISE EXCEPTION 'Cannot assign member to an archived department';
            END IF;
        END IF;
    END IF;

    UPDATE public.organization_members
    SET display_name = trim(p_display_name),
        username = lower(trim(p_username)),
        job_title = CASE WHEN p_job_title IS NOT NULL AND trim(p_job_title) = '' THEN NULL ELSE trim(p_job_title) END,
        department_id = p_department_id,
        updated_at = timezone('utc', now())
    WHERE organization_id = p_org_id AND user_id = p_target_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_member_profile TO authenticated;

-- 2. FIX STAFF_PROFILES RLS PRIVACY
DROP POLICY IF EXISTS "Staff profiles visibility" ON public.staff_profiles;
CREATE POLICY "Staff profiles visibility" ON public.staff_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.organization_members m1
    JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = auth.uid() 
      AND m2.user_id = staff_profiles.user_id
      AND m1.access_status = 'approved'
      AND (m1.role = 'admin' OR public.is_org_owner(m1.organization_id))
  )
);

COMMIT;

