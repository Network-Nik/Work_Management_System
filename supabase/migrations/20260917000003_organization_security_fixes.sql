-- Migration: organization_security_fixes
-- Description: Fixes missing authenticated grants and removes lingering global admin update policy.

BEGIN;

-- 1. Grant missing privileges to authenticated role
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;

-- 2. Drop the legacy global admin policy that allowed cross-org updates
DROP POLICY IF EXISTS "Administrators can manage staff profiles" ON public.staff_profiles;

COMMIT;
