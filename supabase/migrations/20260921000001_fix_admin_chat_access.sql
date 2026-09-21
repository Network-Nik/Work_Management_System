CREATE OR REPLACE FUNCTION public.has_conversation_access(p_conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conv record;
    v_member record;
BEGIN
    SELECT type, organization_id, department_id INTO v_conv
    FROM public.chat_conversations
    WHERE id = p_conv_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    SELECT access_status, department_id INTO v_member
    FROM public.organization_members
    WHERE organization_id = v_conv.organization_id AND user_id = auth.uid();

    IF NOT FOUND OR v_member.access_status != 'approved' THEN
        RETURN false;
    END IF;

    IF v_conv.type = 'direct' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.chat_conversation_members
            WHERE conversation_id = p_conv_id AND user_id = auth.uid()
        );
    ELSIF v_conv.type = 'department' THEN
        IF public.is_org_admin(v_conv.organization_id) THEN
            RETURN true;
        END IF;

        RETURN v_member.department_id = v_conv.department_id;
    END IF;

    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.has_conversation_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_conversation_access(uuid) TO authenticated;
