-- Description: Grants Managers access to view the approved staff roster for assigning work.

-- 1. Create a security definer function to safely check for manager role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_staff_manager() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = auth.uid() AND role = 'manager'
  );
$$;

-- Secure the function
REVOKE ALL ON FUNCTION public.is_staff_manager() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_manager() TO authenticated;

-- 2. Add the narrow SELECT policy for managers
CREATE POLICY "Managers can view approved staff roster"
ON public.staff_profiles
FOR SELECT
TO authenticated
USING (
  public.is_staff_manager() AND access_status = 'approved'
);

