BEGIN;

-- 1. CREATE customer_groups
CREATE TABLE public.customer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CREATE customer_group_members
CREATE TABLE public.customer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_group_members_role_check CHECK (role IN ('owner', 'admin')),
    UNIQUE(group_id, user_id)
);

-- 3. MODIFY organizations
ALTER TABLE public.organizations
ADD COLUMN group_id UUID REFERENCES public.customer_groups(id) ON DELETE RESTRICT;

-- DO block for 1:1 backfill of organizations
DO $$
DECLARE
    org RECORD;
    v_group_id UUID;
BEGIN
    FOR org IN SELECT id, name FROM public.organizations WHERE group_id IS NULL LOOP
        -- Create exactly one customer_group with fallback name
        INSERT INTO public.customer_groups (name)
        VALUES (org.name || ' Group')
        RETURNING id INTO v_group_id;

        -- Update organization's group_id
        UPDATE public.organizations
        SET group_id = v_group_id
        WHERE id = org.id;
    END LOOP;
END;
$$;

-- After all existing organizations are backfilled, set NOT NULL and index
ALTER TABLE public.organizations
ALTER COLUMN group_id SET NOT NULL;

CREATE INDEX idx_organizations_group_id ON public.organizations(group_id);

-- 4. BACKFILL EXISTING OWNER
DO $$
DECLARE
    owner_rec RECORD;
    v_group_id UUID;
BEGIN
    FOR owner_rec IN 
        SELECT organization_id, user_id 
        FROM public.organization_owners
    LOOP
        -- Find that organization's new customer_groups row
        SELECT group_id INTO v_group_id 
        FROM public.organizations 
        WHERE id = owner_rec.organization_id;

        IF v_group_id IS NOT NULL THEN
            -- Create customer_group_members row
            INSERT INTO public.customer_group_members (group_id, user_id, role)
            VALUES (v_group_id, owner_rec.user_id, 'owner')
            ON CONFLICT (group_id, user_id) DO NOTHING;
        END IF;
    END LOOP;
END;
$$;

-- 5. RLS / SECURITY
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_group_members ENABLE ROW LEVEL SECURITY;

-- Security helper
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.customer_group_members
        WHERE group_id = p_group_id AND user_id = auth.uid()
    );
$$;

-- RLS Policies for customer_groups
CREATE POLICY "Group members can view their groups" ON public.customer_groups
FOR SELECT TO authenticated
USING (public.is_group_member(id));

-- RLS Policies for customer_group_members
CREATE POLICY "Users can view their own group memberships" ON public.customer_group_members
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_group_member(group_id));

COMMIT;

