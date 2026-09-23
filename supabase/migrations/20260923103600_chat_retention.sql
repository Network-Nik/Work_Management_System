-- 1. Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 2. Create created_at index optimized for retention queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- 3. Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_chat_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    DELETE FROM public.chat_messages
    WHERE created_at < timezone('utc', now()) - interval '30 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

-- 4 & 5. Harden function security and revoke execution from standard roles
REVOKE ALL ON FUNCTION public.cleanup_expired_chat_messages() FROM public, anon, authenticated;

-- 6. Schedule the daily cron job (midnight UTC)
SELECT cron.schedule(
    'chat-retention-cleanup',
    '0 0 * * *',
    'SELECT public.cleanup_expired_chat_messages();'
);

