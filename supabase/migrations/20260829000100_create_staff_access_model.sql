create extension if not exists citext;

create type public.staff_access_status as enum ('pending', 'approved', 'rejected');
create type public.whatsapp_registration_status as enum ('pending', 'verified', 'rejected');

create table public.approved_staff_emails (
  email citext primary key,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  whatsapp_number text unique,
  whatsapp_status public.whatsapp_registration_status not null default 'pending',
  access_status public.staff_access_status not null default 'pending',
  is_admin boolean not null default false,
  approved_by uuid references public.staff_profiles(user_id),
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint staff_profiles_whatsapp_number_format
    check (whatsapp_number is null or whatsapp_number ~ '^\\+[1-9][0-9]{7,14}$'),
  constraint staff_profiles_verified_whatsapp_number
    check (whatsapp_status <> 'verified' or whatsapp_number is not null),
  constraint staff_profiles_approval_metadata
    check (
      (access_status = 'approved' and approved_by is not null and approved_at is not null)
      or (access_status <> 'approved' and approved_by is null and approved_at is null)
    )
);

create index staff_profiles_access_status_idx
  on public.staff_profiles (access_status);

create index staff_profiles_whatsapp_status_idx
  on public.staff_profiles (whatsapp_status);

create or replace function public.set_access_model_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.normalize_staff_profile_values()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email = lower(trim(new.email));

  if new.whatsapp_number is not null then
    new.whatsapp_number = '+' || regexp_replace(new.whatsapp_number, '[^0-9]', '', 'g');
  end if;

  return new;
end;
$$;

create trigger set_approved_staff_emails_updated_at
before update on public.approved_staff_emails
for each row execute function public.set_access_model_timestamps();

create trigger normalize_staff_profile_values
before insert or update on public.staff_profiles
for each row execute function public.normalize_staff_profile_values();

create trigger set_staff_profiles_updated_at
before update on public.staff_profiles
for each row execute function public.set_access_model_timestamps();

create or replace function public.is_staff_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles
    where user_id = auth.uid()
      and access_status = 'approved'
      and approved_by is not null
      and approved_at is not null
      and is_admin = true
  );
$$;

create or replace function public.is_approved_staff_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.approved_staff_emails
    where email = lower(auth.jwt() ->> 'email')::citext
  );
$$;

alter table public.approved_staff_emails enable row level security;
alter table public.staff_profiles enable row level security;

revoke all on table public.approved_staff_emails from anon, authenticated;
revoke all on table public.staff_profiles from anon, authenticated;
grant select, insert, update on table public.staff_profiles to authenticated;

create policy "Staff can view their own profile"
on public.staff_profiles
for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff_admin()));

create policy "Allowlisted users can create a pending profile"
on public.staff_profiles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and email = lower((select auth.jwt() ->> 'email'))::citext
  and access_status = 'pending'
  and is_admin = false
  and approved_by is null
  and approved_at is null
  and (select public.is_approved_staff_email())
);

create policy "Staff can update their registration details"
on public.staff_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and email = lower((select auth.jwt() ->> 'email'))::citext
  and access_status = 'pending'
  and is_admin = false
  and approved_by is null
  and approved_at is null
);

create policy "Administrators can manage staff profiles"
on public.staff_profiles
for update
to authenticated
using ((select public.is_staff_admin()))
with check ((select public.is_staff_admin()));

revoke all on function public.is_staff_admin() from public;
grant execute on function public.is_staff_admin() to authenticated;
revoke all on function public.is_approved_staff_email() from public;
grant execute on function public.is_approved_staff_email() to authenticated;