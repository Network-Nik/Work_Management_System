BEGIN;

-- ============================================================
-- 1. UPDATE RLS POLICY FOR ORGANIZATIONS
-- ============================================================
CREATE POLICY "Owners update org" ON public.organizations 
FOR UPDATE TO authenticated
USING (public.is_org_owner(id))
WITH CHECK (public.is_org_owner(id));

-- Note: SELECT policy "Orgs visible to members" remains unchanged.

-- ============================================================
-- 2. FIX BOOTSTRAP FIRST ADMIN RPC
-- ============================================================
-- Modifies bootstrap_first_admin to correctly insert the newly 
-- created admin into public.organization_owners.
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
    VALUES (v_org_id, lower(auth.jwt() ->> 'email')::citext, v_user_id)
    ON CONFLICT (organization_id, email) DO NOTHING;

    -- Insert Profile (Idempotent: upgrade access_status and role if existing)
    INSERT INTO public.staff_profiles (user_id, email, whatsapp_number, access_status, role, approved_by, approved_at)
    VALUES (
      v_user_id, lower(auth.jwt() ->> 'email')::citext, 
      NULLIF(trim(whatsapp_num), ''), 
      'approved', 'admin', v_user_id, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET 
      access_status = 'approved',
      role = 'admin',
      approved_by = v_user_id,
      approved_at = now();

    -- Insert Membership
    INSERT INTO public.organization_members (organization_id, user_id, role, access_status, approved_by, approved_at)
    VALUES (v_org_id, v_user_id, 'admin', 'approved', v_user_id, now())
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
      role = 'admin',
      access_status = 'approved',
      approved_by = v_user_id,
      approved_at = now();

    -- Insert Ownership
    INSERT INTO public.organization_owners (organization_id, user_id, assigned_by)
    VALUES (v_org_id, v_user_id, v_user_id)
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    INSERT INTO public.organization_owner_audit (organization_id, actor_id, target_user_id, action)
    VALUES (v_org_id, v_user_id, v_user_id, 'added');
END;
$$;

-- ============================================================
-- 3. REPAIR CURRENT OWNERLESS STATE
-- ============================================================
-- Specifically targets Legacy Company if it currently has 0 owners.
-- Safely crowns online.nikiecreation@gmail.com if they are an admin.
DO $$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
BEGIN
    -- Safely locate Legacy Company
    SELECT id INTO v_org_id FROM public.organizations WHERE name = 'Legacy Company' LIMIT 1;
    
    -- Safely locate the known stranded admin user
    SELECT user_id INTO v_user_id FROM public.staff_profiles WHERE email = 'online.nikiecreation@gmail.com' LIMIT 1;

    IF v_org_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        -- Verify the user is actually an approved admin of Legacy Company
        IF EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE organization_id = v_org_id 
              AND user_id = v_user_id 
              AND access_status = 'approved' 
              AND role = 'admin'
        ) THEN
            -- Verify Legacy Company has ZERO owners currently (no one is being overwritten)
            IF NOT EXISTS (SELECT 1 FROM public.organization_owners WHERE organization_id = v_org_id) THEN
                
                -- Insert missing ownership
                INSERT INTO public.organization_owners (organization_id, user_id)
                VALUES (v_org_id, v_user_id);

                -- Audit log
                INSERT INTO public.organization_owner_audit (organization_id, target_user_id, action)
                VALUES (v_org_id, v_user_id, 'added');
                
            END IF;
        END IF;
    END IF;
END;
$$;

COMMIT;

