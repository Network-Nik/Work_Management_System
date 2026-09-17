-- Migration: super_admin_ownership
-- Description: Adds Super Admin / Organization Ownership features and patches organization_members role bypass.

BEGIN;

-- 1. ROLE BYPASS FIX FOR organization_members
REVOKE UPDATE ON TABLE public.organization_members FROM authenticated;
-- Grant ONLY non-privileged columns that clients legitimately need to update (approval workflows)
GRANT UPDATE (access_status, approved_by, approved_at) ON TABLE public.organization_members TO authenticated;

-- 2. OWNERSHIP DATA MODEL
CREATE TABLE public.organization_owners (
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.staff_profiles(user_id) ON DELETE CASCADE,
    assigned_by uuid REFERENCES public.staff_profiles(user_id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (organization_id, user_id)
);

CREATE TYPE public.owner_audit_action AS ENUM ('added', 'removed');

CREATE TABLE public.organization_owner_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES public.staff_profiles(user_id) ON DELETE SET NULL,
    target_user_id uuid NOT NULL REFERENCES public.staff_profiles(user_id) ON DELETE CASCADE,
    action public.owner_audit_action NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- 3. RLS AND GRANTS
ALTER TABLE public.organization_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_owner_audit ENABLE ROW LEVEL SECURITY;

-- Select is granted; mutations only happen via SECURITY DEFINER RPCs.
GRANT SELECT ON TABLE public.organization_owners TO authenticated;
GRANT SELECT ON TABLE public.organization_owner_audit TO authenticated;

-- Owners visibility: Members of the organization can see the owners.
CREATE POLICY "Owners visible to org members" ON public.organization_owners FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = organization_owners.organization_id 
        AND user_id = auth.uid()
    )
);

-- Audit visibility: Only owners can see the ownership audit log.
CREATE POLICY "Owner audit visible to owners" ON public.organization_owner_audit FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_owners 
        WHERE organization_id = organization_owner_audit.organization_id 
        AND user_id = auth.uid()
    )
);

-- 4. OWNER AUTHORIZATION HELPER
CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_owners
        WHERE organization_id = p_org_id AND user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated;

-- 5. ADMIN AUTHORITY UPDATE
-- Modifying is_org_admin so owners always have operational Admin authority independently of staff_role.
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT 
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = p_org_id 
        AND user_id = auth.uid() 
        AND access_status = 'approved' 
        AND role = 'admin'
    ) 
    OR public.is_org_owner(p_org_id);
$$;

-- 6. UPDATE_STAFF_ROLE PROTECTION
CREATE OR REPLACE FUNCTION public.update_staff_role(target_user_id uuid, target_org_id uuid, new_role public.staff_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_current_role public.staff_role;
    v_admin_count int;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_org_admin(target_org_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Block role mutation if target is an owner.
    IF EXISTS (SELECT 1 FROM public.organization_owners WHERE organization_id = target_org_id AND user_id = target_user_id) THEN
        RAISE EXCEPTION 'Cannot modify roles of an organization owner.';
    END IF;

    SELECT role INTO v_current_role 
    FROM public.organization_members 
    WHERE organization_id = target_org_id AND user_id = target_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found in organization';
    END IF;

    IF v_current_role = new_role THEN
        RETURN;
    END IF;

    -- Last Admin Protection per organization
    IF v_current_role = 'admin' AND new_role != 'admin' THEN
        -- We lock the organization_members table to prevent concurrent demotions
        LOCK TABLE public.organization_members IN EXCLUSIVE MODE;
        
        SELECT count(*) INTO v_admin_count 
        FROM public.organization_members 
        WHERE organization_id = target_org_id AND role = 'admin' AND access_status = 'approved';
        
        IF v_admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot demote the last approved admin.';
        END IF;
    END IF;

    UPDATE public.organization_members SET role = new_role 
    WHERE organization_id = target_org_id AND user_id = target_user_id;
    
    -- Legacy synchronization
    UPDATE public.staff_profiles SET role = new_role WHERE user_id = target_user_id;
END;
$$;

-- 7. MAXIMUM TWO OWNERS TRIGGER (Defense-in-Depth)
CREATE OR REPLACE FUNCTION public.enforce_max_owners() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_owner_count int;
BEGIN
    SELECT count(*) INTO v_owner_count FROM public.organization_owners WHERE organization_id = NEW.organization_id;
    IF v_owner_count >= 2 THEN
        RAISE EXCEPTION 'Maximum of 2 owners allowed per organization';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_enforce_max_owners
BEFORE INSERT ON public.organization_owners
FOR EACH ROW
EXECUTE FUNCTION public.enforce_max_owners();

-- 8. ADD OWNER RPC
CREATE OR REPLACE FUNCTION public.add_organization_owner(p_target_user_id uuid, p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_owner_count int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT public.is_org_owner(p_org_id) THEN RAISE EXCEPTION 'Unauthorized: Only owners can add owners'; END IF;

    -- Serialize concurrency on the parent organization row
    PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;

    IF EXISTS (SELECT 1 FROM public.organization_owners WHERE organization_id = p_org_id AND user_id = p_target_user_id) THEN
        RAISE EXCEPTION 'User is already an owner';
    END IF;

    SELECT count(*) INTO v_owner_count FROM public.organization_owners WHERE organization_id = p_org_id;
    IF v_owner_count >= 2 THEN
        RAISE EXCEPTION 'Organization already has the maximum of 2 owners';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id AND access_status = 'approved') THEN
        RAISE EXCEPTION 'Target user must be an approved organization member';
    END IF;

    INSERT INTO public.organization_owners (organization_id, user_id, assigned_by)
    VALUES (p_org_id, p_target_user_id, auth.uid());

    INSERT INTO public.organization_owner_audit (organization_id, actor_id, target_user_id, action)
    VALUES (p_org_id, auth.uid(), p_target_user_id, 'added');

    -- Promote to admin if they are not already
    UPDATE public.organization_members SET role = 'admin' 
    WHERE organization_id = p_org_id AND user_id = p_target_user_id AND role != 'admin';
    
    UPDATE public.staff_profiles SET role = 'admin' 
    WHERE user_id = p_target_user_id AND role != 'admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_organization_owner(uuid, uuid) TO authenticated;

-- 9. REMOVE OWNER RPC
CREATE OR REPLACE FUNCTION public.remove_organization_owner(p_target_user_id uuid, p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_owner_count int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT public.is_org_owner(p_org_id) THEN RAISE EXCEPTION 'Unauthorized: Only owners can remove owners'; END IF;

    IF auth.uid() = p_target_user_id THEN
        RAISE EXCEPTION 'Cannot remove yourself as an owner';
    END IF;

    -- Serialize concurrency on the parent organization row
    PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;

    IF NOT EXISTS (SELECT 1 FROM public.organization_owners WHERE organization_id = p_org_id AND user_id = p_target_user_id) THEN
        RAISE EXCEPTION 'Target user is not an owner';
    END IF;

    SELECT count(*) INTO v_owner_count FROM public.organization_owners WHERE organization_id = p_org_id;
    IF v_owner_count <= 1 THEN
        RAISE EXCEPTION 'Cannot remove the last owner';
    END IF;

    DELETE FROM public.organization_owners WHERE organization_id = p_org_id AND user_id = p_target_user_id;

    INSERT INTO public.organization_owner_audit (organization_id, actor_id, target_user_id, action)
    VALUES (p_org_id, auth.uid(), p_target_user_id, 'removed');
    
    -- We do NOT demote the user from the admin role in organization_members.
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_organization_owner(uuid, uuid) TO authenticated;

-- 10. FIRST OWNER BOOTSTRAP DO-BLOCK
DO $$
DECLARE
    v_legacy_org_id uuid;
    v_first_admin_id uuid;
BEGIN
    -- Locate the Legacy Company. Using LIMIT 1 to ensure a scalar result.
    SELECT id INTO v_legacy_org_id FROM public.organizations WHERE name = 'Legacy Company' LIMIT 1;
    
    IF v_legacy_org_id IS NOT NULL THEN
        -- Find the oldest approved Admin in this organization.
        SELECT user_id INTO v_first_admin_id 
        FROM public.organization_members 
        WHERE organization_id = v_legacy_org_id 
          AND role = 'admin' 
          AND access_status = 'approved'
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_first_admin_id IS NOT NULL THEN
            -- Only insert if not already bootstrapped to keep it idempotent.
            IF NOT EXISTS (SELECT 1 FROM public.organization_owners WHERE organization_id = v_legacy_org_id AND user_id = v_first_admin_id) THEN
                INSERT INTO public.organization_owners (organization_id, user_id)
                VALUES (v_legacy_org_id, v_first_admin_id);
                
                INSERT INTO public.organization_owner_audit (organization_id, target_user_id, action)
                VALUES (v_legacy_org_id, v_first_admin_id, 'added');
            END IF;
        END IF;
    END IF;
END;
$$;

COMMIT;

