-- Migration: organization_foundation
-- Description: Multi-tenant organization foundation, moving access control to organization_members.

BEGIN;

-- 1. Create Base Tables
CREATE TABLE public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

CREATE TRIGGER set_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_access_model_timestamps();

CREATE TABLE public.organization_members (
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
    role public.staff_role not null default 'employee',
    access_status public.staff_access_status not null default 'pending',
    approved_by uuid references public.staff_profiles(user_id) on delete set null,
    approved_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (organization_id, user_id),
    constraint organization_members_approval_metadata
      check (
        (access_status = 'approved' and approved_by is not null and approved_at is not null)
        or (access_status <> 'approved' and approved_by is null and approved_at is null)
      )
);

CREATE TRIGGER set_organization_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.set_access_model_timestamps();

-- 2. Alter Existing Tables
ALTER TABLE public.approved_staff_emails ADD COLUMN organization_id uuid references public.organizations(id) on delete cascade;
ALTER TABLE public.work_assignments ADD COLUMN organization_id uuid references public.organizations(id) on delete cascade;

-- 3. Legacy Bootstrap & Data Backfill
DO $$
DECLARE
    v_legacy_org_id uuid;
BEGIN
    INSERT INTO public.organizations (name) VALUES ('Legacy Company') RETURNING id INTO v_legacy_org_id;

    -- Backfill members from legacy staff_profiles columns
    INSERT INTO public.organization_members (organization_id, user_id, role, access_status, approved_by, approved_at)
    SELECT v_legacy_org_id, user_id, role, access_status, approved_by, approved_at
    FROM public.staff_profiles;

    -- Backfill allowlist
    UPDATE public.approved_staff_emails SET organization_id = v_legacy_org_id;

    -- Backfill assignments
    UPDATE public.work_assignments SET organization_id = v_legacy_org_id;
END
$$;

-- 4. Constraint Enforcement
ALTER TABLE public.approved_staff_emails ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.work_assignments ALTER COLUMN organization_id SET NOT NULL;

-- Change PK on approved_staff_emails to include organization_id
ALTER TABLE public.approved_staff_emails DROP CONSTRAINT approved_staff_emails_pkey;
ALTER TABLE public.approved_staff_emails ADD PRIMARY KEY (organization_id, email);

-- Indexes for performance
CREATE INDEX idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX idx_work_assignments_org ON public.work_assignments(organization_id);

-- 5. Helper Functions (Organization-Aware)
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid() AND access_status = 'approved' AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid() AND access_status = 'approved' AND role = 'manager'
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_org_manager(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid) TO authenticated;

-- 6. Refactored Legacy Global Functions (for back-compat and transition)
CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  -- Checks if caller is admin in ANY org (legacy fallback)
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND access_status = 'approved' AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND access_status = 'approved' AND role = 'manager'
  );
$$;

-- 7. Rewrite update_staff_role
CREATE OR REPLACE FUNCTION public.update_staff_role(target_user_id uuid, target_org_id uuid, new_role public.staff_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_current_role public.staff_role;
    v_admin_count int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT public.is_org_admin(target_org_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    SELECT role INTO v_current_role FROM public.organization_members WHERE user_id = target_user_id AND organization_id = target_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Target user not found in organization'; END IF;
    IF v_current_role = new_role THEN RETURN; END IF;

    -- Last Admin Protection per organization
    IF v_current_role = 'admin' AND new_role != 'admin' THEN
        -- We lock the organization_members table to prevent concurrent demotions
        LOCK TABLE public.organization_members IN EXCLUSIVE MODE;
        
        SELECT count(*) INTO v_admin_count 
        FROM public.organization_members 
        WHERE organization_id = target_org_id AND role = 'admin' AND access_status = 'approved';
        
        IF v_admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot demote the last approved admin of the organization.';
        END IF;
    END IF;

    UPDATE public.organization_members SET role = new_role WHERE user_id = target_user_id AND organization_id = target_org_id;
    
    -- Legacy Sync
    UPDATE public.staff_profiles SET role = new_role WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_staff_role(uuid, uuid, public.staff_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_role(uuid, uuid, public.staff_role) TO authenticated;

-- Overwrite old signature so it fails fast
DROP FUNCTION IF EXISTS public.update_staff_role(uuid, public.staff_role);

-- 8. Bootstrap First Admin
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(whatsapp_num text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    LOCK TABLE public.organization_members IN EXCLUSIVE MODE;
    
    IF EXISTS (SELECT 1 FROM public.organization_members WHERE role = 'admin') THEN
        RAISE EXCEPTION 'System already bootstrapped';
    END IF;

    -- Create Legacy Org
    INSERT INTO public.organizations (name) VALUES ('Initial Company') RETURNING id INTO v_org_id;

    -- Insert Allowlist
    INSERT INTO public.approved_staff_emails (organization_id, email, added_by)
    VALUES (v_org_id, lower(auth.jwt() ->> 'email')::citext, v_user_id);

    -- Insert Profile
    INSERT INTO public.staff_profiles (user_id, email, whatsapp_number, access_status, role, approved_by, approved_at)
    VALUES (
      v_user_id, lower(auth.jwt() ->> 'email')::citext, 
      NULLIF(trim(whatsapp_num), ''), 
      'approved', 'admin', v_user_id, now()
    );

    -- Insert Membership
    INSERT INTO public.organization_members (organization_id, user_id, role, access_status, approved_by, approved_at)
    VALUES (v_org_id, v_user_id, 'admin', 'approved', v_user_id, now());
END;
$$;

-- 9. Work Assignment RPCs
-- accept_work
CREATE OR REPLACE FUNCTION public.accept_work(p_id uuid, p_established_deadline timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_assignment public.work_assignments;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;

    IF v_assignment.assignee_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized: Only assignee can accept'; END IF;
    IF v_assignment.status != 'pending' THEN RAISE EXCEPTION 'Invalid transition'; END IF;

    -- Membership check
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_assignment.organization_id AND user_id = auth.uid() AND access_status = 'approved') THEN
        RAISE EXCEPTION 'Unauthorized: Not an active member of the organization';
    END IF;

    PERFORM set_config('app.audit_comment', NULL, true);
    UPDATE public.work_assignments SET status = 'active', established_deadline = p_established_deadline WHERE id = p_id;
END;
$$;

-- decline_work
CREATE OR REPLACE FUNCTION public.decline_work(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_assignment public.work_assignments;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF trim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'Reason required'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    IF v_assignment.assignee_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized: Only assignee can decline'; END IF;
    IF v_assignment.status != 'pending' THEN RAISE EXCEPTION 'Invalid transition'; END IF;

    PERFORM set_config('app.audit_comment', p_reason, true);
    UPDATE public.work_assignments SET status = 'declined' WHERE id = p_id;
END;
$$;

-- complete_work
CREATE OR REPLACE FUNCTION public.complete_work(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_assignment public.work_assignments;
    v_role public.staff_role;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    
    SELECT role INTO v_role FROM public.organization_members WHERE organization_id = v_assignment.organization_id AND user_id = auth.uid() AND access_status = 'approved';
    
    IF v_assignment.assignee_id != auth.uid() AND v_role != 'admin' AND NOT (v_assignment.assigner_id = auth.uid() AND v_role = 'manager') THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF v_assignment.status != 'active' THEN RAISE EXCEPTION 'Invalid transition'; END IF;

    UPDATE public.work_assignments SET status = 'completed', completed_at = now() WHERE id = p_id;
END;
$$;

-- cancel_work
CREATE OR REPLACE FUNCTION public.cancel_work(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_assignment public.work_assignments;
    v_role public.staff_role;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    
    SELECT role INTO v_role FROM public.organization_members WHERE organization_id = v_assignment.organization_id AND user_id = auth.uid() AND access_status = 'approved';
    
    IF v_role != 'admin' AND NOT (v_assignment.assigner_id = auth.uid() AND v_role = 'manager') THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF v_assignment.status NOT IN ('pending', 'active') THEN RAISE EXCEPTION 'Invalid transition'; END IF;

    PERFORM set_config('app.audit_comment', p_reason, true);
    UPDATE public.work_assignments SET status = 'cancelled' WHERE id = p_id;
END;
$$;

-- override_deadline
CREATE OR REPLACE FUNCTION public.override_deadline(p_id uuid, p_new_deadline timestamptz, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_assignment public.work_assignments;
    v_role public.staff_role;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF trim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'Reason required'; END IF;
    IF p_new_deadline IS NULL THEN RAISE EXCEPTION 'New deadline required'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    
    SELECT role INTO v_role FROM public.organization_members WHERE organization_id = v_assignment.organization_id AND user_id = auth.uid() AND access_status = 'approved';
    
    IF v_role != 'admin' AND NOT (v_assignment.assigner_id = auth.uid() AND v_role = 'manager') THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF v_assignment.status != 'active' THEN RAISE EXCEPTION 'Invalid state'; END IF;
    IF p_new_deadline < v_assignment.assigned_at THEN RAISE EXCEPTION 'Invalid deadline'; END IF;

    PERFORM set_config('app.audit_comment', p_reason, true);
    UPDATE public.work_assignments SET established_deadline = p_new_deadline WHERE id = p_id;
END;
$$;

-- 10. Update RLS Policies

-- organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orgs visible to members" ON public.organizations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = id AND user_id = auth.uid()));

GRANT SELECT ON public.organizations TO authenticated;

-- organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members visibility" ON public.organization_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.organization_members caller
    WHERE caller.organization_id = organization_members.organization_id
      AND caller.user_id = auth.uid()
      AND caller.access_status = 'approved'
      AND (caller.role = 'admin' OR (caller.role = 'manager' AND organization_members.access_status = 'approved'))
  )
);
CREATE POLICY "Admins update org members" ON public.organization_members FOR UPDATE TO authenticated
USING (public.is_org_admin(organization_id))
WITH CHECK (public.is_org_admin(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;

-- staff_profiles
DROP POLICY IF EXISTS "Staff can view their own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Managers can view approved staff roster" ON public.staff_profiles;
DROP POLICY IF EXISTS "Administrators can manage staff profiles" ON public.staff_profiles;

CREATE POLICY "Staff profiles visibility" ON public.staff_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.organization_members m1
    JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = auth.uid() 
      AND m2.user_id = staff_profiles.user_id
      AND m1.access_status = 'approved'
      AND (m1.role = 'admin' OR (m1.role = 'manager' AND m2.access_status = 'approved'))
  )
);

-- approved_staff_emails
DROP POLICY IF EXISTS "Admins can view allowlist" ON public.approved_staff_emails;
DROP POLICY IF EXISTS "Admins can insert allowlist" ON public.approved_staff_emails;
DROP POLICY IF EXISTS "Admins can delete allowlist" ON public.approved_staff_emails;

CREATE POLICY "Admins manage allowlist" ON public.approved_staff_emails FOR ALL TO authenticated
USING (public.is_org_admin(organization_id))
WITH CHECK (public.is_org_admin(organization_id));

-- work_assignments
DROP POLICY IF EXISTS "Staff can view their assignments" ON public.work_assignments;
DROP POLICY IF EXISTS "Managers and Admins can create assignments" ON public.work_assignments;
DROP POLICY IF EXISTS "Work assignments visibility" ON public.work_assignments;
DROP POLICY IF EXISTS "Managers and Admins can create assignments" ON public.work_assignments;

CREATE POLICY "Work assignments visibility" ON public.work_assignments FOR SELECT TO authenticated
USING (
  assignee_id = auth.uid() OR 
  assigner_id = auth.uid() OR 
  public.is_org_admin(organization_id)
);

CREATE POLICY "Managers and Admins create assignments" ON public.work_assignments FOR INSERT TO authenticated
WITH CHECK (
  assigner_id = auth.uid() AND 
  (public.is_org_manager(organization_id) OR public.is_org_admin(organization_id)) AND
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = work_assignments.organization_id
      AND user_id = assignee_id
      AND access_status = 'approved'
  )
);

-- work_assignment_events
DROP POLICY IF EXISTS "Staff can view events for their assignments" ON public.work_assignment_events;
DROP POLICY IF EXISTS "Work assignment events visibility" ON public.work_assignment_events;

CREATE POLICY "Work assignment events visibility" ON public.work_assignment_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.work_assignments
    WHERE id = work_assignment_events.assignment_id
      AND (assignee_id = auth.uid() OR assigner_id = auth.uid() OR public.is_org_admin(organization_id))
  )
);

COMMIT;
