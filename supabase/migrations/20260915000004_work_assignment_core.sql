-- Migration: work_assignment_core
-- Description: Creates the core database schema, state machine, audit log, and RPCs for Work Assignments.

-- 1. Enums
CREATE TYPE public.work_assignment_status AS ENUM ('pending', 'active', 'completed', 'declined', 'cancelled');
CREATE TYPE public.assignment_event_type AS ENUM ('created', 'accepted', 'declined', 'cancelled', 'completed', 'deadline_updated', 'details_updated');
CREATE TYPE public.notification_type AS ENUM ('assigned', 'accepted', 'declined', 'completed', 'cancelled', 'deadline_override');

-- 2. Tables
CREATE TABLE public.work_assignments (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    reference_id text,
    description text,
    assigner_id uuid not null references public.staff_profiles(user_id) on delete restrict,
    assignee_id uuid not null references public.staff_profiles(user_id) on delete restrict,
    status public.work_assignment_status not null default 'pending',
    assigned_at timestamptz not null default now(),
    target_deadline timestamptz,
    established_deadline timestamptz,
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    constraint check_established_deadline check (established_deadline >= assigned_at),
    constraint check_completed_at check (status <> 'completed' or completed_at is not null),
    constraint check_active_deadline check (status not in ('active', 'completed') or established_deadline is not null)
);

CREATE TABLE public.work_assignment_events (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references public.work_assignments(id) on delete cascade,
    actor_id uuid references public.staff_profiles(user_id) on delete set null,
    event_type public.assignment_event_type not null,
    previous_state jsonb,
    new_state jsonb,
    comment text,
    created_at timestamptz not null default now()
);

CREATE TABLE public.in_app_notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references public.staff_profiles(user_id) on delete cascade,
    actor_id uuid references public.staff_profiles(user_id) on delete set null,
    assignment_id uuid not null references public.work_assignments(id) on delete cascade,
    type public.notification_type not null,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

-- 3. Indexes
CREATE INDEX idx_work_assignee_status ON public.work_assignments(assignee_id, status);
CREATE INDEX idx_work_assigner_status ON public.work_assignments(assigner_id, status);
CREATE INDEX idx_work_established_deadline ON public.work_assignments(established_deadline);
CREATE INDEX idx_work_events_assignment ON public.work_assignment_events(assignment_id);
CREATE INDEX idx_notifications_recipient_read ON public.in_app_notifications(recipient_id, is_read);

-- 4. Audit Trigger
CREATE OR REPLACE FUNCTION public.audit_work_assignment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event_type public.assignment_event_type;
    v_actor_id uuid := auth.uid();
    v_comment text := current_setting('app.audit_comment', true);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_event_type := 'created';
        INSERT INTO public.work_assignment_events (assignment_id, actor_id, event_type, new_state, comment)
        VALUES (NEW.id, v_actor_id, v_event_type, row_to_json(NEW)::jsonb, v_comment);
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status = 'active' THEN v_event_type := 'accepted';
            ELSIF NEW.status = 'declined' THEN v_event_type := 'declined';
            ELSIF NEW.status = 'cancelled' THEN v_event_type := 'cancelled';
            ELSIF NEW.status = 'completed' THEN v_event_type := 'completed';
            ELSE v_event_type := 'details_updated';
            END IF;
        ELSIF NEW.established_deadline IS DISTINCT FROM OLD.established_deadline THEN
            v_event_type := 'deadline_updated';
        ELSE
            v_event_type := 'details_updated';
        END IF;

        IF NEW IS DISTINCT FROM OLD THEN
            INSERT INTO public.work_assignment_events (assignment_id, actor_id, event_type, previous_state, new_state, comment)
            VALUES (NEW.id, v_actor_id, v_event_type, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_comment);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_work_assignment_change
AFTER INSERT OR UPDATE ON public.work_assignments
FOR EACH ROW EXECUTE FUNCTION public.audit_work_assignment_changes();

CREATE TRIGGER set_work_assignments_updated_at
BEFORE UPDATE ON public.work_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_access_model_timestamps();

-- 5. RLS
ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_assignment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.work_assignments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.work_assignments TO authenticated;

REVOKE ALL ON TABLE public.work_assignment_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.work_assignment_events TO authenticated;

REVOKE ALL ON TABLE public.in_app_notifications FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.in_app_notifications TO authenticated;

-- Policies for work_assignments
CREATE POLICY "Users can view relevant work assignments"
ON public.work_assignments FOR SELECT TO authenticated
USING (
    assignee_id = auth.uid() OR 
    assigner_id = auth.uid() OR 
    public.is_staff_admin()
);

CREATE POLICY "Admins and Managers can assign work"
ON public.work_assignments FOR INSERT TO authenticated
WITH CHECK (
    assigner_id = auth.uid() AND 
    (SELECT role FROM public.staff_profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
);

CREATE POLICY "Work assignments are immutable via direct client update"
ON public.work_assignments FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

-- Policies for work_assignment_events
CREATE POLICY "Users can view relevant events"
ON public.work_assignment_events FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.work_assignments 
        WHERE id = public.work_assignment_events.assignment_id 
        AND (assignee_id = auth.uid() OR assigner_id = auth.uid() OR public.is_staff_admin())
    )
);

-- Policies for in_app_notifications
CREATE POLICY "Users can view their own notifications"
ON public.in_app_notifications FOR SELECT TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Users can insert notifications"
ON public.in_app_notifications FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Users can mark their own notifications as read"
ON public.in_app_notifications FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());


-- 6. State Transition RPCs

-- Accept Work
CREATE OR REPLACE FUNCTION public.accept_work(p_id uuid, p_established_deadline timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.work_assignments;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    IF v_assignment.assignee_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized: Only assignee can accept'; END IF;
    IF v_assignment.status != 'pending' THEN RAISE EXCEPTION 'Invalid transition: Assignment is not pending'; END IF;
    IF p_established_deadline IS NULL THEN RAISE EXCEPTION 'Established deadline is required'; END IF;

    UPDATE public.work_assignments 
    SET status = 'active', established_deadline = p_established_deadline 
    WHERE id = p_id;
END;
$$;

-- Decline Work
CREATE OR REPLACE FUNCTION public.decline_work(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.work_assignments;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF trim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'Reason required for declining'; END IF;
    
    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    IF v_assignment.assignee_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized: Only assignee can decline'; END IF;
    IF v_assignment.status != 'pending' THEN RAISE EXCEPTION 'Invalid transition: Assignment is not pending'; END IF;

    PERFORM set_config('app.audit_comment', p_reason, true);
    
    UPDATE public.work_assignments 
    SET status = 'declined' 
    WHERE id = p_id;
END;
$$;

-- Complete Work
CREATE OR REPLACE FUNCTION public.complete_work(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.work_assignments;
    v_role public.staff_role;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    
    SELECT role INTO v_role FROM public.staff_profiles WHERE user_id = auth.uid();
    
    IF v_assignment.assignee_id != auth.uid() AND v_role != 'admin' AND NOT (v_assignment.assigner_id = auth.uid() AND v_role = 'manager') THEN 
        RAISE EXCEPTION 'Unauthorized: Cannot complete this assignment'; 
    END IF;
    
    IF v_assignment.status != 'active' THEN RAISE EXCEPTION 'Invalid transition: Assignment is not active'; END IF;

    UPDATE public.work_assignments 
    SET status = 'completed', completed_at = now() 
    WHERE id = p_id;
END;
$$;

-- Cancel Work
CREATE OR REPLACE FUNCTION public.cancel_work(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.work_assignments;
    v_role public.staff_role;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    
    SELECT role INTO v_role FROM public.staff_profiles WHERE user_id = auth.uid();
    
    IF v_role != 'admin' AND NOT (v_assignment.assigner_id = auth.uid() AND v_role = 'manager') THEN 
        RAISE EXCEPTION 'Unauthorized: Cannot cancel this assignment'; 
    END IF;
    
    IF v_assignment.status NOT IN ('pending', 'active') THEN RAISE EXCEPTION 'Invalid transition: Cannot cancel from current status'; END IF;

    PERFORM set_config('app.audit_comment', p_reason, true);

    UPDATE public.work_assignments 
    SET status = 'cancelled' 
    WHERE id = p_id;
END;
$$;

-- Override Deadline
CREATE OR REPLACE FUNCTION public.override_deadline(p_id uuid, p_new_deadline timestamptz, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.work_assignments;
    v_role public.staff_role;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF trim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'Reason required for overriding deadline'; END IF;
    IF p_new_deadline IS NULL THEN RAISE EXCEPTION 'New deadline is required'; END IF;

    SELECT * INTO v_assignment FROM public.work_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
    
    SELECT role INTO v_role FROM public.staff_profiles WHERE user_id = auth.uid();
    
    IF v_role != 'admin' AND NOT (v_assignment.assigner_id = auth.uid() AND v_role = 'manager') THEN 
        RAISE EXCEPTION 'Unauthorized: Cannot override deadline'; 
    END IF;
    
    IF v_assignment.status != 'active' THEN RAISE EXCEPTION 'Invalid state: Assignment is not active'; END IF;
    IF p_new_deadline < v_assignment.assigned_at THEN RAISE EXCEPTION 'Invalid data: Deadline cannot be before assigned_at'; END IF;

    PERFORM set_config('app.audit_comment', p_reason, true);

    UPDATE public.work_assignments 
    SET established_deadline = p_new_deadline 
    WHERE id = p_id;
END;
$$;

-- Secure Grants
REVOKE ALL ON FUNCTION public.audit_work_assignment_changes() FROM public, anon;

REVOKE ALL ON FUNCTION public.accept_work(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_work(uuid, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.decline_work(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decline_work(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_work(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_work(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_work(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_work(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.override_deadline(uuid, timestamptz, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.override_deadline(uuid, timestamptz, text) TO authenticated;

