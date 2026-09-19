-- Secure profile RPCs by enforcing approved status and explicitly managing EXECUTE grants

CREATE OR REPLACE FUNCTION public.update_self_profile(p_org_id uuid, p_display_name text, p_username text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_role text;
    v_access_status public.staff_access_status;
    v_current_display text;
    v_current_username text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    SELECT role, access_status, display_name, username 
    INTO v_role, v_access_status, v_current_display, v_current_username 
    FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = auth.uid();
    
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;

    IF v_access_status != 'approved' THEN
        RAISE EXCEPTION 'User membership is not approved';
    END IF;

    -- Block managers and employees from editing AFTER their profile has been setup
    IF v_role IN ('manager', 'employee') AND v_current_display IS NOT NULL AND v_current_username IS NOT NULL THEN
        IF v_role = 'manager' THEN
            RAISE EXCEPTION 'Managers must contact an administrator to update their profile.';
        ELSE
            RAISE EXCEPTION 'Employees must contact an administrator to update their profile.';
        END IF;
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
$function$;

REVOKE ALL ON FUNCTION public.update_self_profile(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_self_profile(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_member_profile(uuid, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_member_profile(uuid, uuid, jsonb) TO authenticated;
