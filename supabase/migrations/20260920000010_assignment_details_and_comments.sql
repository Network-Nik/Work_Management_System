-- 1. Create centralized access helper
CREATE OR REPLACE FUNCTION public.has_assignment_access(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.work_assignments wa
    WHERE wa.id = p_assignment_id
    AND (
      public.is_org_admin(wa.organization_id)
      OR (
        (wa.assignee_id = auth.uid() OR wa.assigner_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = wa.organization_id
            AND om.user_id = auth.uid()
            AND om.access_status = 'approved'
        )
      )
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.has_assignment_access FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_assignment_access TO authenticated;

-- 2. Create work_assignment_comments table
CREATE TABLE public.work_assignment_comments (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references public.work_assignments(id) on delete cascade,
    author_id uuid not null references public.staff_profiles(user_id) on delete restrict,
    content text not null,
    created_at timestamp with time zone not null default now()
);

CREATE INDEX idx_work_assignment_comments_assignment ON public.work_assignment_comments(assignment_id);

ALTER TABLE public.work_assignment_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignment comments visibility"
ON public.work_assignment_comments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.work_assignments
        WHERE id = work_assignment_comments.assignment_id
    )
);

-- We omit INSERT/UPDATE/DELETE policies, meaning they default to deny for the client.

-- 3. Create add_assignment_comment RPC
CREATE OR REPLACE FUNCTION public.add_assignment_comment(p_assignment_id uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_assignment public.work_assignments;
    v_clean_content text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    v_clean_content := trim(coalesce(p_content, ''));
    IF v_clean_content = '' THEN RAISE EXCEPTION 'Content cannot be empty'; END IF;
    IF length(v_clean_content) > 2000 THEN RAISE EXCEPTION 'Content exceeds 2000 characters'; END IF;

    -- Fetch assignment to verify existence FOR UPDATE
    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;

    -- Verify access
    IF NOT public.has_assignment_access(p_assignment_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    INSERT INTO public.work_assignment_comments (assignment_id, author_id, content)
    VALUES (p_assignment_id, auth.uid(), v_clean_content);
END;
$function$;

REVOKE ALL ON FUNCTION public.add_assignment_comment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_assignment_comment TO authenticated;

-- 4. Create identity resolution RPC
CREATE OR REPLACE FUNCTION public.resolve_assignment_identities(p_assignment_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    RETURN QUERY
    SELECT DISTINCT om.user_id, om.display_name, om.username
    FROM public.organization_members om
    WHERE om.user_id IN (
        SELECT wa.assignee_id FROM public.work_assignments wa WHERE wa.id = ANY(p_assignment_ids) AND public.has_assignment_access(wa.id)
        UNION
        SELECT wa.assigner_id FROM public.work_assignments wa WHERE wa.id = ANY(p_assignment_ids) AND public.has_assignment_access(wa.id)
        UNION
        SELECT wac.author_id FROM public.work_assignment_comments wac WHERE wac.assignment_id = ANY(p_assignment_ids) AND public.has_assignment_access(wac.assignment_id)
        UNION
        SELECT wae.actor_id FROM public.work_assignment_events wae WHERE wae.assignment_id = ANY(p_assignment_ids) AND public.has_assignment_access(wae.assignment_id)
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_assignment_identities FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_assignment_identities TO authenticated;
