BEGIN;

-- 1. AVAILABILITY
ALTER TABLE public.organization_members
ADD COLUMN availability text NOT NULL DEFAULT 'available';

ALTER TABLE public.organization_members
ADD CONSTRAINT check_availability CHECK (availability IN ('available', 'busy', 'focused', 'away'));

CREATE OR REPLACE FUNCTION public.update_my_availability(p_org_id uuid, p_availability text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_availability NOT IN ('available', 'busy', 'focused', 'away') THEN RAISE EXCEPTION 'Invalid availability status'; END IF;

    UPDATE public.organization_members
    SET availability = p_availability,
        updated_at = now()
    WHERE organization_id = p_org_id 
      AND user_id = auth.uid() 
      AND access_status = 'approved';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized or not an approved member of this organization';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_availability(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_my_availability(uuid, text) TO authenticated;

-- 2. WORK_PULSE_ENTRIES
CREATE TABLE public.work_pulse_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'in_progress',
    started_at timestamptz NOT NULL DEFAULT now(),
    estimated_end_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT work_pulse_status_check
        CHECK (status IN ('in_progress', 'blocked', 'completed')),
    CONSTRAINT work_pulse_title_not_empty
        CHECK (trim(title) <> ''),
    CONSTRAINT work_pulse_title_max_length
        CHECK (length(title) <= 200),
    CONSTRAINT work_pulse_description_max_length
        CHECK (description IS NULL OR length(description) <= 1000),
    CONSTRAINT work_pulse_estimated_after_started
        CHECK (estimated_end_at IS NULL OR estimated_end_at >= started_at),
    CONSTRAINT work_pulse_completed_at_required
        CHECK (
            (status = 'completed' AND completed_at IS NOT NULL) OR 
            (status <> 'completed' AND completed_at IS NULL)
        )
);

-- 3. NORMALIZATION & IMMUTABILITY TRIGGERS
CREATE OR REPLACE FUNCTION public.normalize_work_pulse_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    NEW.title = trim(NEW.title);
    IF NEW.title = '' THEN
        RAISE EXCEPTION 'Title cannot be empty';
    END IF;

    IF NEW.description IS NOT NULL THEN
        NEW.description = trim(NEW.description);
        IF NEW.description = '' THEN
            NEW.description = NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_work_pulse_entry() FROM public, anon;

CREATE TRIGGER tr_normalize_work_pulse_entry
BEFORE INSERT OR UPDATE ON public.work_pulse_entries
FOR EACH ROW EXECUTE FUNCTION public.normalize_work_pulse_entry();

CREATE OR REPLACE FUNCTION public.prevent_pulse_identity_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'organization_id is immutable';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'user_id is immutable';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_pulse_identity_mutation() FROM public, anon;

CREATE TRIGGER tr_ensure_pulse_identity_immutable
BEFORE UPDATE ON public.work_pulse_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_pulse_identity_mutation();

-- Standard updated_at trigger reused from existing system
CREATE TRIGGER tr_set_work_pulse_entries_updated_at
BEFORE UPDATE ON public.work_pulse_entries
FOR EACH ROW EXECUTE FUNCTION public.set_access_model_timestamps();

-- 4. RLS & GRANTS
ALTER TABLE public.work_pulse_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON TABLE public.work_pulse_entries TO authenticated;

CREATE POLICY "Work pulse visible to org members" ON public.work_pulse_entries FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = work_pulse_entries.organization_id
          AND user_id = auth.uid()
          AND access_status = 'approved'
    )
);

CREATE POLICY "Users create own pulse entries" ON public.work_pulse_entries FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = work_pulse_entries.organization_id
          AND user_id = auth.uid()
          AND access_status = 'approved'
    )
);

CREATE POLICY "Work pulse entries are immutable via direct client update" ON public.work_pulse_entries FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

-- 5. UPDATE RPC
CREATE OR REPLACE FUNCTION public.update_work_pulse_entry(
    p_entry_id uuid,
    p_title text,
    p_description text,
    p_status text,
    p_estimated_end_at timestamptz
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_entry public.work_pulse_entries;
    v_effective_status text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_entry FROM public.work_pulse_entries WHERE id = p_entry_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pulse entry not found'; END IF;

    IF v_entry.user_id != auth.uid() THEN 
        RAISE EXCEPTION 'Unauthorized: Can only update your own pulse entries'; 
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = v_entry.organization_id 
          AND user_id = auth.uid() 
          AND access_status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Not a currently approved member of this organization';
    END IF;

    v_effective_status := coalesce(p_status, v_entry.status);

    UPDATE public.work_pulse_entries
    SET title = coalesce(p_title, v_entry.title),
        description = p_description,
        status = v_effective_status,
        estimated_end_at = p_estimated_end_at,
        completed_at = CASE 
            WHEN v_effective_status = 'completed' AND v_entry.status != 'completed' THEN now()
            WHEN v_effective_status = 'completed' THEN coalesce(v_entry.completed_at, now())
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_work_pulse_entry(uuid, text, text, text, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_work_pulse_entry(uuid, text, text, text, timestamptz) TO authenticated;

-- 6. INDEXES
CREATE INDEX idx_work_pulse_org_active ON public.work_pulse_entries(organization_id, status) WHERE status IN ('in_progress', 'blocked');
CREATE INDEX idx_work_pulse_org_user ON public.work_pulse_entries(organization_id, user_id);
CREATE INDEX idx_work_assignments_completed ON public.work_assignments(organization_id, completed_at) WHERE status = 'completed';

-- 7. COMPANY PROGRESS RPC
CREATE OR REPLACE FUNCTION public.get_company_progress(
    p_org_id uuid,
    p_period text
)
RETURNS TABLE (
    bucket timestamp,
    completed_count bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_start timestamptz;
    v_end timestamptz;
    v_interval interval;
    v_bucket_size text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_org_id AND user_id = auth.uid() AND access_status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Must be an approved member of the organization';
    END IF;

    v_end := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '1 day';

    IF p_period = '7d' THEN
        v_start := v_end - interval '7 days';
        v_interval := '1 day'::interval;
        v_bucket_size := 'day';
    ELSIF p_period = '30d' THEN
        v_start := v_end - interval '30 days';
        v_interval := '1 day'::interval;
        v_bucket_size := 'day';
    ELSIF p_period = '1y' THEN
        v_end := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '1 month';
        v_start := v_end - interval '1 year';
        v_interval := '1 month'::interval;
        v_bucket_size := 'month';
    ELSE
        RAISE EXCEPTION 'Invalid period: must be 7d, 30d, or 1y';
    END IF;

    RETURN QUERY
    WITH date_spine AS (
        SELECT generate_series(
            (v_start AT TIME ZONE 'UTC'), 
            (v_end AT TIME ZONE 'UTC') - v_interval, 
            v_interval
        ) AS bucket_ts
    )
    SELECT 
        ds.bucket_ts AS bucket,
        COUNT(wa.id)::bigint AS completed_count
    FROM date_spine ds
    LEFT JOIN public.work_assignments wa
        ON wa.organization_id = p_org_id
        AND wa.status = 'completed'
        AND wa.completed_at >= v_start
        AND wa.completed_at < v_end
        AND date_trunc(v_bucket_size, wa.completed_at AT TIME ZONE 'UTC') = ds.bucket_ts
    GROUP BY ds.bucket_ts
    ORDER BY ds.bucket_ts ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_progress(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_company_progress(uuid, text) TO authenticated;

COMMIT;
