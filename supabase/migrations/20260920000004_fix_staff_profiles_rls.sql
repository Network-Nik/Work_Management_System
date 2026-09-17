BEGIN;

-- ============================================================
-- 4E-D HOTFIX: Fix staff_profiles RLS recursion
-- ============================================================
-- ROOT CAUSE: The current "Staff profiles visibility" policy joins
-- organization_members, which triggers organization_members RLS,
-- causing PostgreSQL to abort with infinite recursion.
--
-- FIX: Lock staff_profiles SELECT to self-only. Provide a narrow
-- SECURITY DEFINER RPC for Admin/Owner cross-user contact lookups.
-- ============================================================

-- 1. Replace the recursive staff_profiles SELECT policy with self-only
DROP POLICY IF EXISTS "Staff profiles visibility" ON public.staff_profiles;
CREATE POLICY "Staff profiles visibility" ON public.staff_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 2. Create a narrow SECURITY DEFINER RPC for Admin/Owner contact lookups
-- Returns ONLY: user_id, email, whatsapp_number
-- Verifies: caller is authenticated, is_org_admin for the target org,
--           and target user belongs to the same org.
CREATE OR REPLACE FUNCTION public.get_org_member_contacts(
    p_org_id uuid,
    p_user_ids uuid[]
)
RETURNS TABLE (
    user_id uuid,
    email citext,
    whatsapp_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Owner access required';
    END IF;

    RETURN QUERY
    SELECT sp.user_id, sp.email, sp.whatsapp_number
    FROM public.staff_profiles sp
    JOIN public.organization_members om
      ON om.user_id = sp.user_id
     AND om.organization_id = p_org_id
    WHERE sp.user_id = ANY(p_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_member_contacts(uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_org_member_contacts(uuid, uuid[]) TO authenticated;

-- 3. Create a SECURITY DEFINER RPC for admin staff management listing
-- Returns staff profiles for users who have an organization_members row
-- in the caller's organization, filtered by access_status.
CREATE OR REPLACE FUNCTION public.get_org_staff_profiles(
    p_org_id uuid,
    p_access_status staff_access_status
)
RETURNS TABLE (
    user_id uuid,
    email citext,
    whatsapp_number text,
    role staff_role,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Owner access required';
    END IF;

    RETURN QUERY
    SELECT sp.user_id, sp.email, sp.whatsapp_number, sp.role, sp.created_at
    FROM public.staff_profiles sp
    JOIN public.organization_members om
      ON om.user_id = sp.user_id
     AND om.organization_id = p_org_id
    WHERE sp.access_status = p_access_status
    ORDER BY sp.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_staff_profiles(uuid, staff_access_status) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_org_staff_profiles(uuid, staff_access_status) TO authenticated;

COMMIT;
