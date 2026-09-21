-- 1. Department channel provisioning trigger
CREATE OR REPLACE FUNCTION public.trigger_provision_department_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    INSERT INTO public.chat_conversations (organization_id, type, department_id, dm_identifier)
    VALUES (NEW.organization_id, 'department', NEW.id, NULL)
    ON CONFLICT (organization_id, department_id) DO NOTHING;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trigger_provision_department_channel() FROM public, anon;

CREATE TRIGGER provision_department_channel_after_insert
AFTER INSERT ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_provision_department_channel();

-- 2. Backfill existing departments
INSERT INTO public.chat_conversations (organization_id, type, department_id, dm_identifier)
SELECT organization_id, 'department', id, NULL
FROM public.departments
ON CONFLICT (organization_id, department_id) DO NOTHING;

-- 3. Resolve chat identities
CREATE OR REPLACE FUNCTION public.resolve_chat_identities(p_conversation_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    RETURN QUERY
    WITH authorized_conversations AS (
        SELECT id, organization_id
        FROM public.chat_conversations
        WHERE id = ANY(p_conversation_ids) AND public.has_conversation_access(id)
    ),
    authorized_actors AS (
        SELECT ac.organization_id, ccm.user_id AS actor_id
        FROM authorized_conversations ac
        JOIN public.chat_conversation_members ccm ON ccm.conversation_id = ac.id
        UNION
        SELECT ac.organization_id, cm.sender_id AS actor_id
        FROM authorized_conversations ac
        JOIN public.chat_messages cm ON cm.conversation_id = ac.id
    )
    SELECT DISTINCT om.user_id, om.display_name, om.username
    FROM public.organization_members om
    JOIN authorized_actors aa
      ON aa.organization_id = om.organization_id
     AND aa.actor_id = om.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_chat_identities(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_chat_identities(uuid[]) TO authenticated;

-- 4. Get org directory (for New DM modal)
CREATE OR REPLACE FUNCTION public.get_org_directory(p_org_id uuid)
RETURNS TABLE(user_id uuid, display_name text, username text, job_title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
    SELECT om.user_id, om.display_name, om.username, om.job_title
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.access_status = 'approved';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_org_directory(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_org_directory(uuid) TO authenticated;
