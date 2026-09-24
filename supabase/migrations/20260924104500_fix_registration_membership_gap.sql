BEGIN;

-- ============================================================
-- FIX REGISTRATION MEMBERSHIP GAP
-- ============================================================
-- Modifies register_staff_profile to be idempotent, allowing it
-- to repair missing organization_members rows for legacy users
-- who already have a staff_profiles row but got stranded.

CREATE OR REPLACE FUNCTION public.register_staff_profile(p_whatsapp_number text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id uuid;
    v_email citext;
BEGIN
    v_user_id := auth.uid();
    v_email := lower(auth.jwt() ->> 'email')::citext;
    
    IF v_user_id IS NULL OR v_email IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.approved_staff_emails WHERE email = v_email) THEN
        RAISE EXCEPTION 'Email is not allowlisted';
    END IF;

    -- 1. Insert global profile (Idempotent: preserve existing profile if it exists)
    INSERT INTO public.staff_profiles (user_id, email, whatsapp_number, access_status, role)
    VALUES (v_user_id, v_email, NULLIF(trim(p_whatsapp_number), ''), 'pending', 'employee')
    ON CONFLICT (user_id) DO NOTHING;

    -- 2. Insert pending memberships for every org where email is allowlisted
    -- (Idempotent: preserves existing memberships, only creates missing ones)
    INSERT INTO public.organization_members (organization_id, user_id, role, access_status)
    SELECT organization_id, v_user_id, 'employee', 'pending'
    FROM public.approved_staff_emails
    WHERE email = v_email
    ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$;

-- Modifies bootstrap_first_admin to also be idempotent,
-- ensuring the first admin can bootstrap even if their auth
-- account previously generated a stranded staff_profiles row.

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
END;
$$;

COMMIT;
