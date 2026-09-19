-- Fix cross-organization identity disclosure by strictly coupling the identity 
-- lookup to the exact organization_id of the authorized assignment.

CREATE OR REPLACE FUNCTION public.resolve_assignment_identities(p_assignment_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    RETURN QUERY
    WITH authorized_actors AS (
        SELECT wa.organization_id, wa.assignee_id AS actor_id 
        FROM public.work_assignments wa 
        WHERE wa.id = ANY(p_assignment_ids) AND public.has_assignment_access(wa.id)
        
        UNION
        
        SELECT wa.organization_id, wa.assigner_id AS actor_id 
        FROM public.work_assignments wa 
        WHERE wa.id = ANY(p_assignment_ids) AND public.has_assignment_access(wa.id)
        
        UNION
        
        SELECT wa.organization_id, wac.author_id AS actor_id 
        FROM public.work_assignment_comments wac 
        JOIN public.work_assignments wa ON wa.id = wac.assignment_id 
        WHERE wa.id = ANY(p_assignment_ids) AND public.has_assignment_access(wa.id)
        
        UNION
        
        SELECT wa.organization_id, wae.actor_id 
        FROM public.work_assignment_events wae 
        JOIN public.work_assignments wa ON wa.id = wae.assignment_id 
        WHERE wa.id = ANY(p_assignment_ids) AND public.has_assignment_access(wa.id)
    )
    SELECT DISTINCT om.user_id, om.display_name, om.username
    FROM public.organization_members om
    JOIN authorized_actors aa 
      ON aa.organization_id = om.organization_id 
     AND aa.actor_id = om.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_assignment_identities(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_assignment_identities(uuid[]) TO authenticated;
