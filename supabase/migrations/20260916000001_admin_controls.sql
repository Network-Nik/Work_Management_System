-- Migration: admin_controls
-- Description: Adds admin controls for allowlist and secure role updates.

-- 1. Tighten staff_profiles UPDATE privileges
REVOKE UPDATE ON TABLE public.staff_profiles FROM authenticated;
GRANT UPDATE (email, whatsapp_number, whatsapp_status, access_status, approved_by, approved_at, updated_at) 
ON TABLE public.staff_profiles TO authenticated;

-- 2. Open allowlist table to authenticated Admins
GRANT SELECT, INSERT, DELETE ON TABLE public.approved_staff_emails TO authenticated;

CREATE POLICY "Admins can view allowlist" 
ON public.approved_staff_emails FOR SELECT 
TO authenticated USING (public.is_staff_admin());

CREATE POLICY "Admins can insert allowlist" 
ON public.approved_staff_emails FOR INSERT 
TO authenticated WITH CHECK (public.is_staff_admin());

CREATE POLICY "Admins can delete allowlist" 
ON public.approved_staff_emails FOR DELETE 
TO authenticated USING (public.is_staff_admin());

-- 3. Create Role Update RPC
CREATE OR REPLACE FUNCTION public.update_staff_role(target_user_id uuid, new_role public.staff_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_role public.staff_role;
    v_admin_count int;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_staff_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role INTO v_current_role FROM public.staff_profiles WHERE user_id = target_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found';
    END IF;

    IF v_current_role = new_role THEN
        RETURN;
    END IF;

    -- Last Admin Protection
    IF v_current_role = 'admin' AND new_role != 'admin' THEN
        LOCK TABLE public.staff_profiles IN EXCLUSIVE MODE;
        
        SELECT count(*) INTO v_admin_count 
        FROM public.staff_profiles 
        WHERE role = 'admin' AND access_status = 'approved';
        
        IF v_admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot demote the last approved admin.';
        END IF;
    END IF;

    UPDATE public.staff_profiles SET role = new_role WHERE user_id = target_user_id;
END;
$$;

-- 4. Secure RPC Grants
REVOKE ALL ON FUNCTION public.update_staff_role(uuid, public.staff_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_role(uuid, public.staff_role) TO authenticated;

