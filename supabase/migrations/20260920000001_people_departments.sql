-- Migration: people_and_departments
-- Description: Introduces organization-scoped identities (display name, username) and departments.

BEGIN;

-- 1. DEPARTMENTS TABLE
CREATE TABLE public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (id, organization_id), -- Required for composite FK
    UNIQUE (organization_id, name)
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.departments TO authenticated;

CREATE POLICY "View org departments" ON public.departments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = departments.organization_id
          AND user_id = auth.uid()
    )
);

-- 2. AUGMENT ORGANIZATION MEMBERS
ALTER TABLE public.organization_members
ADD COLUMN display_name text,
ADD COLUMN username text,
ADD COLUMN job_title text,
ADD COLUMN department_id uuid;

ALTER TABLE public.organization_members
ADD CONSTRAINT check_username_lower CHECK (username = lower(username)),
ADD CONSTRAINT check_username_chars CHECK (username ~ '^[a-z0-9_.-]+$'),
ADD CONSTRAINT check_username_length CHECK (char_length(username) BETWEEN 3 AND 30),
ADD CONSTRAINT check_username_reserved CHECK (username NOT IN ('admin', 'system', 'owner', 'everyone', 'here', 'all', 'support', 'null')),
ADD CONSTRAINT unique_org_username UNIQUE (organization_id, username),
ADD CONSTRAINT fk_org_dept FOREIGN KEY (department_id, organization_id) REFERENCES public.departments(id, organization_id) ON DELETE SET NULL;

CREATE INDEX idx_org_members_username ON public.organization_members(organization_id, username);
CREATE INDEX idx_org_members_dept ON public.organization_members(organization_id, department_id);

-- 3. DEPARTMENT MANAGEMENT RPC
CREATE OR REPLACE FUNCTION public.manage_department(
    p_org_id uuid,
    p_name text,
    p_description text DEFAULT NULL,
    p_is_active boolean DEFAULT true,
    p_dept_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_dept_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT public.is_org_admin(p_org_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    IF p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Department name is required';
    END IF;

    IF p_dept_id IS NULL THEN
        -- Insert
        INSERT INTO public.departments (organization_id, name, description, is_active)
        VALUES (p_org_id, trim(p_name), trim(p_description), p_is_active)
        RETURNING id INTO v_dept_id;
    ELSE
        -- Update
        UPDATE public.departments
        SET name = trim(p_name),
            description = trim(p_description),
            is_active = p_is_active,
            updated_at = timezone('utc', now())
        WHERE id = p_dept_id AND organization_id = p_org_id
        RETURNING id INTO v_dept_id;
        
        IF v_dept_id IS NULL THEN
            RAISE EXCEPTION 'Department not found';
        END IF;
    END IF;
    
    RETURN v_dept_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_department TO authenticated;

-- 4. PROFILE MANAGEMENT RPC
CREATE OR REPLACE FUNCTION public.update_member_profile(
    p_org_id uuid,
    p_target_user_id uuid,
    p_display_name text,
    p_username text,
    p_job_title text DEFAULT NULL,
    p_department_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_is_self boolean;
    v_is_admin boolean;
    v_current_dept uuid;
    v_current_title text;
    v_dept_active boolean;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    v_is_self := (auth.uid() = p_target_user_id);
    v_is_admin := public.is_org_admin(p_org_id);

    IF NOT (v_is_self OR v_is_admin) THEN
        RAISE EXCEPTION 'Unauthorized to edit this profile';
    END IF;
    
    -- Ensure user is a member of the org
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id) THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;

    IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
        RAISE EXCEPTION 'Display name is required';
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username is required';
    END IF;

    -- If self-editing but NOT an admin, ensure they aren't changing their own protected fields
    IF v_is_self AND NOT v_is_admin THEN
        SELECT job_title, department_id INTO v_current_title, v_current_dept
        FROM public.organization_members
        WHERE organization_id = p_org_id AND user_id = p_target_user_id;

        IF COALESCE(p_job_title, '') IS DISTINCT FROM COALESCE(v_current_title, '') OR 
           COALESCE(p_department_id, '00000000-0000-0000-0000-000000000000'::uuid) IS DISTINCT FROM COALESCE(v_current_dept, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            RAISE EXCEPTION 'You cannot modify your own job title or department';
        END IF;
    END IF;

    -- If assigning to a department, verify it exists and is active (unless they are already in it, then they can stay)
    IF p_department_id IS NOT NULL THEN
        SELECT is_active INTO v_dept_active FROM public.departments WHERE id = p_department_id AND organization_id = p_org_id;
        IF v_dept_active IS NULL THEN
            RAISE EXCEPTION 'Department does not exist';
        END IF;
        
        -- If changing TO an inactive department, block it
        IF NOT v_dept_active THEN
            SELECT department_id INTO v_current_dept FROM public.organization_members WHERE organization_id = p_org_id AND user_id = p_target_user_id;
            IF v_current_dept IS DISTINCT FROM p_department_id THEN
                RAISE EXCEPTION 'Cannot assign member to an archived department';
            END IF;
        END IF;
    END IF;

    UPDATE public.organization_members
    SET display_name = trim(p_display_name),
        username = lower(trim(p_username)),
        job_title = CASE WHEN p_job_title IS NOT NULL AND trim(p_job_title) = '' THEN NULL ELSE trim(p_job_title) END,
        department_id = p_department_id,
        updated_at = timezone('utc', now())
    WHERE organization_id = p_org_id AND user_id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_profile TO authenticated;

COMMIT;

