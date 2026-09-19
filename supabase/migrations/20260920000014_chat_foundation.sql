-- 4F-A: Internal Communication Data Foundation

CREATE TYPE public.chat_conversation_type AS ENUM ('direct', 'department');

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type public.chat_conversation_type NOT NULL,
    department_id uuid,
    dm_identifier text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    last_message_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT chat_conversations_org_dept_fkey FOREIGN KEY (department_id, organization_id) REFERENCES public.departments(id, organization_id) ON DELETE CASCADE,
    CONSTRAINT chat_conversations_type_check CHECK (
        (type = 'direct' AND department_id IS NULL AND dm_identifier IS NOT NULL) OR
        (type = 'department' AND department_id IS NOT NULL AND dm_identifier IS NULL)
    ),
    CONSTRAINT chat_conversations_dm_unique UNIQUE (organization_id, dm_identifier),
    CONSTRAINT chat_conversations_dept_unique UNIQUE (organization_id, department_id)
);

CREATE INDEX idx_chat_conversations_org_last_msg ON public.chat_conversations(organization_id, last_message_at DESC);

CREATE TABLE public.chat_conversation_members (
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT chat_messages_content_check CHECK (trim(content) <> '' AND length(content) <= 2000)
);

CREATE INDEX idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at DESC);

CREATE TABLE public.chat_conversation_reads (
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

-- Access Helper
CREATE OR REPLACE FUNCTION public.has_conversation_access(p_conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
        RETURN v_member.department_id = v_conv.department_id;
    END IF;

    RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.has_conversation_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_conversation_access(uuid) TO authenticated;

-- RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversations visibility" ON public.chat_conversations FOR SELECT TO authenticated USING (public.has_conversation_access(id));
CREATE POLICY "Members visibility" ON public.chat_conversation_members FOR SELECT TO authenticated USING (public.has_conversation_access(conversation_id));
CREATE POLICY "Messages visibility" ON public.chat_messages FOR SELECT TO authenticated USING (public.has_conversation_access(conversation_id));
CREATE POLICY "Reads visibility" ON public.chat_conversation_reads FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RPCs
CREATE OR REPLACE FUNCTION public.create_dm_conversation(p_org_id uuid, p_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_caller_status text;
    v_target_status text;
    v_dm_identifier text;
    v_conv_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF auth.uid() = p_target_user_id THEN RAISE EXCEPTION 'Cannot create DM with yourself'; END IF;

    SELECT access_status INTO v_caller_status FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid();
    IF v_caller_status IS NULL OR v_caller_status != 'approved' THEN
        RAISE EXCEPTION 'Caller is not an approved member of this organization';
    END IF;

    SELECT access_status INTO v_target_status FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id;
    IF v_target_status IS NULL OR v_target_status != 'approved' THEN
        RAISE EXCEPTION 'Target user is not an approved member of this organization';
    END IF;

    IF auth.uid() < p_target_user_id THEN
        v_dm_identifier := auth.uid()::text || '_' || p_target_user_id::text;
    ELSE
        v_dm_identifier := p_target_user_id::text || '_' || auth.uid()::text;
    END IF;

    SELECT id INTO v_conv_id FROM public.chat_conversations WHERE organization_id = p_org_id AND dm_identifier = v_dm_identifier;
    
    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    INSERT INTO public.chat_conversations (organization_id, type, dm_identifier)
    VALUES (p_org_id, 'direct', v_dm_identifier)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.chat_conversation_members (conversation_id, user_id)
    VALUES 
        (v_conv_id, auth.uid()),
        (v_conv_id, p_target_user_id);

    RETURN v_conv_id;
EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_conv_id FROM public.chat_conversations WHERE organization_id = p_org_id AND dm_identifier = v_dm_identifier;
    RETURN v_conv_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_dm_conversation(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_dm_conversation(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_conv_id uuid, p_content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_msg_id uuid;
    v_is_active boolean;
    v_dept_active boolean;
    v_conv record;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF NOT public.has_conversation_access(p_conv_id) THEN
        RAISE EXCEPTION 'Not authorized to send messages to this conversation';
    END IF;

    IF p_content IS NULL OR trim(p_content) = '' THEN
        RAISE EXCEPTION 'Message content cannot be empty';
    END IF;

    IF length(p_content) > 2000 THEN
        RAISE EXCEPTION 'Message content exceeds 2000 characters';
    END IF;

    SELECT type, department_id, is_active INTO v_conv FROM public.chat_conversations WHERE id = p_conv_id;
    
    IF NOT v_conv.is_active THEN
        RAISE EXCEPTION 'Conversation is inactive';
    END IF;

    IF v_conv.type = 'department' THEN
        SELECT is_active INTO v_dept_active FROM public.departments WHERE id = v_conv.department_id;
        IF NOT v_dept_active THEN
            RAISE EXCEPTION 'Cannot send message to archived department channel';
        END IF;
    END IF;

    INSERT INTO public.chat_messages (conversation_id, sender_id, content)
    VALUES (p_conv_id, auth.uid(), trim(p_content))
    RETURNING id INTO v_msg_id;

    UPDATE public.chat_conversations
    SET last_message_at = timezone('utc', now())
    WHERE id = p_conv_id;

    RETURN v_msg_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.send_chat_message(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF NOT public.has_conversation_access(p_conv_id) THEN
        RAISE EXCEPTION 'Not authorized to access this conversation';
    END IF;

    INSERT INTO public.chat_conversation_reads (conversation_id, user_id, last_read_at)
    VALUES (p_conv_id, auth.uid(), timezone('utc', now()))
    ON CONFLICT (conversation_id, user_id) 
    DO UPDATE SET last_read_at = timezone('utc', now());
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
