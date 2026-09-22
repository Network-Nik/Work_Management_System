BEGIN;

DROP FUNCTION IF EXISTS public.get_org_directory(uuid);

CREATE OR REPLACE FUNCTION public.get_org_directory(p_org_id uuid)
RETURNS TABLE(
    user_id uuid,
    display_name text,
    username text,
    job_title text,
    department_id uuid,
    department_name text,
    availability text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_access text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT access_status INTO v_access
    FROM public.organization_members
    WHERE organization_id = p_org_id AND public.organization_members.user_id = auth.uid();

    IF v_access IS NULL OR v_access != 'approved' THEN
        RAISE EXCEPTION 'Not an approved member of this organization';
    END IF;

    RETURN QUERY
    SELECT 
        om.user_id, 
        om.display_name, 
        om.username, 
        om.job_title,
        om.department_id,
        d.name AS department_name,
        om.availability
    FROM public.organization_members om
    LEFT JOIN public.departments d ON om.department_id = d.id
    WHERE om.organization_id = p_org_id
      AND om.access_status = 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_directory(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_org_directory(uuid) TO authenticated;

COMMIT;

