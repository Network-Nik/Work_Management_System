BEGIN;

DROP POLICY IF EXISTS "Orgs visible to members" ON public.organizations;

CREATE POLICY "Orgs visible to members" ON public.organizations 
FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE organization_id = id 
      AND user_id = auth.uid() 
      AND access_status = 'approved'
));

COMMIT;

