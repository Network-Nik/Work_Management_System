BEGIN;

-- ============================================================
-- 4E-D HOTFIX 3: Fix organization_members RLS recursion
-- ============================================================
-- ROOT CAUSE: The "Org members visibility" policy previously contained
-- a recursive EXISTS subquery that queried organization_members.
-- This caused PostgreSQL to abort with infinite recursion (Error 42P17).
-- 
-- FIX: Use the existing STABLE SECURITY DEFINER helper functions
-- (is_org_admin and is_org_manager) to bypass RLS recursion while
-- preserving the exact same security boundaries.
-- ============================================================

DROP POLICY IF EXISTS "Org members visibility" ON public.organization_members;
CREATE POLICY "Org members visibility" ON public.organization_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  public.is_org_admin(organization_id) OR
  (public.is_org_manager(organization_id) AND access_status = 'approved')
);

COMMIT;

