DROP POLICY IF EXISTS "Work assignments visibility" ON public.work_assignments;

CREATE POLICY "Work assignments visibility"
ON public.work_assignments FOR SELECT TO authenticated
USING (
    public.is_org_admin(organization_id)
    OR (
        (assignee_id = auth.uid() OR assigner_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_id = work_assignments.organization_id
              AND user_id = auth.uid()
              AND access_status = 'approved'
        )
    )
);
