-- Phase 1 schema and RPCs for shift management

create extension if not exists pgcrypto;

-- ==== Internal schema ====
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;


-- ==== Tables ====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('admin','reviewer','staff')),
  active boolean not null default true,
  request_type text not null default 'fix' check (request_type in ('fix','flex')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists request_type text not null default 'fix' check (request_type in ('fix','flex'));

create table if not exists public.shift_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  type text not null check (type in ('fix','flex')),
  status text not null check (status in ('pending','approved','rejected','withdrawn')),
  note text,
  reviewer_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  decision_type text,
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Fix
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  approved_start_at timestamptz,
  approved_end_at timestamptz,

  -- Flex
  iso_year int,
  iso_week int,
  week_start_date date,
  requested_hours numeric,
  approved_hours numeric,

  check (
    decision_type is null
    or (type = 'fix' and decision_type in ('approve','modify','reject'))
    or (type = 'flex' and decision_type in ('approve','modify','partial','reject'))
  ),
  check (type <> 'fix' or decision_type is distinct from 'modify' or change_reason is not null),
  check (requested_hours is null or requested_hours > 0),
  check (approved_hours is null or approved_hours > 0),
  check (type <> 'fix' or (requested_start_at is not null and requested_end_at is not null and requested_start_at < requested_end_at)),
  check (type <> 'flex' or (iso_year is not null and iso_week is not null and week_start_date is not null and requested_hours is not null))
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.shift_requests'::regclass and conname = 'shift_requests_check'
  ) then
    alter table public.shift_requests drop constraint shift_requests_check;
  end if;
  alter table public.shift_requests
    add constraint shift_requests_check
    check (
      decision_type is null
      or (type = 'fix' and decision_type in ('approve','modify','reject'))
      or (type = 'flex' and decision_type in ('approve','modify','partial','reject'))
    );

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.shift_requests'::regclass and conname = 'shift_requests_check1'
  ) then
    alter table public.shift_requests drop constraint shift_requests_check1;
  end if;
  alter table public.shift_requests
    add constraint shift_requests_check1
    check (type <> 'fix' or decision_type is distinct from 'modify' or change_reason is not null);
end;
$$;

drop index if exists shift_requests_flex_week_unique;
create unique index if not exists shift_requests_flex_week_unique
  on public.shift_requests(user_id, iso_year, iso_week)
  where type = 'flex' and status in ('pending','approved');

create table if not exists public.shift_request_histories (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shift_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null check (action in ('create','proxy_create','update','withdraw','review','reopen')),
  from_status text,
  to_status text,
  from_decision_type text,
  to_decision_type text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shift_request_histories_request_created_at_idx
  on public.shift_request_histories(request_id, created_at desc);

-- ==== Helper functions ====
create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function private.log_shift_request_history(
  p_request_id uuid,
  p_action text,
  p_actor_id uuid,
  p_from_status text,
  p_to_status text,
  p_from_decision_type text,
  p_to_decision_type text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.shift_request_histories (
    request_id,
    actor_id,
    action,
    from_status,
    to_status,
    from_decision_type,
    to_decision_type,
    details
  )
  values (
    p_request_id,
    p_actor_id,
    p_action,
    p_from_status,
    p_to_status,
    p_from_decision_type,
    p_to_decision_type,
    coalesce(p_details, '{}'::jsonb)
  );
$$;

drop function if exists private.get_audit_logs(int, int, text, text, text);
create or replace function private.get_audit_logs(
  p_limit int default 100,
  p_offset int default 0,
  p_action text default null,
  p_actor text default null,
  p_email text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  ip_address text,
  action text,
  actor_id text,
  actor_username text,
  log_type text,
  traits json,
  payload json
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    id,
    created_at,
    ip_address,
    payload->>'action' as action,
    payload->>'actor_id' as actor_id,
    payload->>'actor_username' as actor_username,
    payload->>'log_type' as log_type,
    payload->'traits' as traits,
    payload as payload
  from auth.audit_log_entries
  where (p_action is null or p_action = '' or payload->>'action' ilike ('%' || p_action || '%'))
    and (p_actor is null or p_actor = '' or (
      payload->>'actor_username' ilike ('%' || p_actor || '%')
      or payload->>'actor_id' ilike ('%' || p_actor || '%')
    ))
    and (p_email is null or p_email = '' or (
      payload->>'actor_username' ilike ('%' || p_email || '%')
      or payload->'traits'->>'user_email' ilike ('%' || p_email || '%')
      or payload->'traits'->>'email' ilike ('%' || p_email || '%')
    ))
  order by created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;


-- ==== updated_at trigger ====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_shift_requests_updated_at on public.shift_requests;
create trigger set_shift_requests_updated_at
  before update on public.shift_requests
  for each row
  execute function public.set_updated_at();

-- ==== RLS ====
alter table public.profiles enable row level security;
alter table public.shift_requests enable row level security;
alter table public.shift_request_histories enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() and active = true);

drop policy if exists profiles_select_admin_reviewer on public.profiles;
create policy profiles_select_admin_reviewer on public.profiles
  for select using (private.current_user_role() in ('admin','reviewer'));

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (private.current_user_role() = 'admin') with check (private.current_user_role() = 'admin');

drop policy if exists shift_requests_select_own on public.shift_requests;
create policy shift_requests_select_own on public.shift_requests
  for select using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
    )
  );

drop policy if exists shift_requests_select_admin_reviewer on public.shift_requests;
create policy shift_requests_select_admin_reviewer on public.shift_requests
  for select using (private.current_user_role() in ('admin','reviewer'));

drop policy if exists shift_request_histories_select_own on public.shift_request_histories;
create policy shift_request_histories_select_own on public.shift_request_histories
  for select using (
    exists (
      select 1
      from public.shift_requests r
      where r.id = shift_request_histories.request_id
        and r.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
    )
  );

drop policy if exists shift_request_histories_select_admin_reviewer on public.shift_request_histories;
create policy shift_request_histories_select_admin_reviewer on public.shift_request_histories
  for select using (private.current_user_role() in ('admin','reviewer'));

-- ==== RPCs ====
create or replace function private.request_fix(start_at timestamptz, end_at timestamptz, note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_type text;
  v_start_jst timestamp;
  v_today_jst date;
  v_max_date date;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.current_user_role() <> 'staff' then
    raise exception 'forbidden';
  end if;
  select request_type into v_request_type from public.profiles where id = v_user_id;
  if v_request_type <> 'fix' then
    raise exception 'request_type_mismatch';
  end if;
  if start_at is null or end_at is null then
    raise exception 'start_end_required';
  end if;
  if start_at >= end_at then
    raise exception 'invalid_time_range';
  end if;
  if end_at - start_at > interval '8 hours' then
    raise exception 'max_hours';
  end if;

  v_start_jst := start_at at time zone 'Asia/Tokyo';
  v_today_jst := (now() at time zone 'Asia/Tokyo')::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;
  if v_start_jst::date < v_today_jst then
    raise exception 'past_not_allowed';
  end if;
  if v_start_jst::date > v_max_date then
    raise exception 'max_lead_time';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = v_user_id
      and r.type = 'fix'
      and r.status in ('pending','approved')
      and tstzrange(coalesce(r.approved_start_at, r.requested_start_at),
                    coalesce(r.approved_end_at, r.requested_end_at), '[)')
          && tstzrange(start_at, end_at, '[)')
  ) then
    raise exception 'overlap';
  end if;

  insert into public.shift_requests (
    user_id, created_by, type, status, note,
    requested_start_at, requested_end_at
  ) values (
    v_user_id, v_user_id, 'fix', 'pending', note,
    start_at, end_at
  ) returning id into v_id;

  perform private.log_shift_request_history(
    v_id,
    'create',
    v_user_id,
    null,
    'pending',
    null,
    null,
    jsonb_build_object(
      'type', 'fix',
      'requested_start_at', start_at,
      'requested_end_at', end_at,
      'note', note
    )
  );

  return v_id;
end;
$$;

create or replace function private.update_fix_request(request_id uuid, start_at timestamptz, end_at timestamptz, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_type text;
  v_start_jst timestamp;
  v_today_jst date;
  v_max_date date;
  v_before public.shift_requests;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.current_user_role() <> 'staff' then
    raise exception 'forbidden';
  end if;
  select request_type into v_request_type from public.profiles where id = v_user_id;
  if v_request_type <> 'fix' then
    raise exception 'request_type_mismatch';
  end if;

  if start_at is null or end_at is null then
    raise exception 'start_end_required';
  end if;
  if start_at >= end_at then
    raise exception 'invalid_time_range';
  end if;
  if end_at - start_at > interval '8 hours' then
    raise exception 'max_hours';
  end if;

  v_start_jst := start_at at time zone 'Asia/Tokyo';
  v_today_jst := (now() at time zone 'Asia/Tokyo')::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;
  if v_start_jst::date < v_today_jst then
    raise exception 'past_not_allowed';
  end if;
  if v_start_jst::date > v_max_date then
    raise exception 'max_lead_time';
  end if;

  select * into v_before from public.shift_requests
    where id = request_id
      and user_id = v_user_id
      and type = 'fix'
      and status = 'pending'
    for update;
  if not found then
    raise exception 'not_found_or_forbidden';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = v_user_id
      and r.type = 'fix'
      and r.status in ('pending','approved')
      and r.id <> request_id
      and tstzrange(coalesce(r.approved_start_at, r.requested_start_at),
                    coalesce(r.approved_end_at, r.requested_end_at), '[)')
          && tstzrange(start_at, end_at, '[)')
  ) then
    raise exception 'overlap';
  end if;

  update public.shift_requests
    set requested_start_at = start_at,
        requested_end_at = end_at,
        note = p_note
  where id = request_id;

  perform private.log_shift_request_history(
    request_id,
    'update',
    v_user_id,
    v_before.status,
    v_before.status,
    v_before.decision_type,
    v_before.decision_type,
    jsonb_build_object(
      'type', 'fix',
      'before_requested_start_at', v_before.requested_start_at,
      'before_requested_end_at', v_before.requested_end_at,
      'after_requested_start_at', start_at,
      'after_requested_end_at', end_at,
      'before_note', v_before.note,
      'after_note', p_note
    )
  );
end;
$$;

drop function if exists private.reopen_fix_request(uuid, timestamptz, timestamptz, text);
create or replace function private.reopen_fix_request(request_id uuid, start_at timestamptz, end_at timestamptz, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_type text;
  v_start_jst timestamp;
  v_today_jst date;
  v_max_date date;
  v_before public.shift_requests;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.current_user_role() <> 'staff' then
    raise exception 'forbidden';
  end if;
  select request_type into v_request_type from public.profiles where id = v_user_id;
  if v_request_type <> 'fix' then
    raise exception 'request_type_mismatch';
  end if;
  if start_at is null or end_at is null then
    raise exception 'start_end_required';
  end if;
  if start_at >= end_at then
    raise exception 'invalid_time_range';
  end if;
  if end_at - start_at > interval '8 hours' then
    raise exception 'max_hours';
  end if;

  v_start_jst := start_at at time zone 'Asia/Tokyo';
  v_today_jst := (now() at time zone 'Asia/Tokyo')::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;
  if v_start_jst::date < v_today_jst then
    raise exception 'past_not_allowed';
  end if;
  if v_start_jst::date > v_max_date then
    raise exception 'max_lead_time';
  end if;

  select * into v_before from public.shift_requests
    where id = request_id
      and user_id = v_user_id
      and type = 'fix'
      and status = 'approved'
    for update;
  if not found then
    raise exception 'not_found_or_forbidden';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = v_user_id
      and r.type = 'fix'
      and r.status in ('pending','approved')
      and r.id <> request_id
      and tstzrange(coalesce(r.approved_start_at, r.requested_start_at),
                    coalesce(r.approved_end_at, r.requested_end_at), '[)')
          && tstzrange(start_at, end_at, '[)')
  ) then
    raise exception 'overlap';
  end if;

  update public.shift_requests
    set status = 'pending',
        decision_type = null,
        reviewer_note = null,
        reviewed_by = null,
        reviewed_at = null,
        change_reason = null,
        approved_start_at = null,
        approved_end_at = null,
        requested_start_at = start_at,
        requested_end_at = end_at,
        note = p_note
  where id = request_id;

  perform private.log_shift_request_history(
    request_id,
    'reopen',
    v_user_id,
    v_before.status,
    'pending',
    v_before.decision_type,
    null,
    jsonb_build_object(
      'type', 'fix',
      'before_requested_start_at', v_before.requested_start_at,
      'before_requested_end_at', v_before.requested_end_at,
      'before_approved_start_at', v_before.approved_start_at,
      'before_approved_end_at', v_before.approved_end_at,
      'after_requested_start_at', start_at,
      'after_requested_end_at', end_at,
      'before_note', v_before.note,
      'after_note', p_note
    )
  );
end;
$$;

create or replace function private.request_flex(date_in_week date, requested_hours numeric, note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_type text;
  v_iso_year int;
  v_iso_week int;
  v_week_start date;
  v_current_week_start date;
  v_max_date date;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.current_user_role() <> 'staff' then
    raise exception 'forbidden';
  end if;
  select request_type into v_request_type from public.profiles where id = v_user_id;
  if v_request_type <> 'flex' then
    raise exception 'request_type_mismatch';
  end if;
  if date_in_week is null then
    raise exception 'date_required';
  end if;
  if requested_hours is null or requested_hours <= 0 then
    raise exception 'invalid_hours';
  end if;
  if requested_hours > 40 then
    raise exception 'max_hours';
  end if;

  v_iso_year := to_char(date_in_week, 'IYYY')::int;
  v_iso_week := to_char(date_in_week, 'IW')::int;
  v_week_start := date_trunc('week', date_in_week)::date;
  v_current_week_start := date_trunc('week', (now() at time zone 'Asia/Tokyo')::date)::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;

  if v_week_start < v_current_week_start then
    raise exception 'past_week_not_allowed';
  end if;
  if date_in_week > v_max_date then
    raise exception 'max_lead_time';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = v_user_id
      and r.type = 'flex'
      and r.status in ('pending','approved')
      and r.iso_year = v_iso_year
      and r.iso_week = v_iso_week
  ) then
    raise exception 'flex_duplicate_week';
  end if;

  insert into public.shift_requests (
    user_id, created_by, type, status, note,
    iso_year, iso_week, week_start_date, requested_hours
  ) values (
    v_user_id, v_user_id, 'flex', 'pending', note,
    v_iso_year, v_iso_week, v_week_start, requested_hours
  ) returning id into v_id;

  perform private.log_shift_request_history(
    v_id,
    'create',
    v_user_id,
    null,
    'pending',
    null,
    null,
    jsonb_build_object(
      'type', 'flex',
      'iso_year', v_iso_year,
      'iso_week', v_iso_week,
      'week_start_date', v_week_start,
      'requested_hours', requested_hours,
      'note', note
    )
  );

  return v_id;
end;
$$;

create or replace function private.update_flex_request(request_id uuid, date_in_week date, p_requested_hours numeric, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_type text;
  v_iso_year int;
  v_iso_week int;
  v_week_start date;
  v_current_week_start date;
  v_max_date date;
  v_before public.shift_requests;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.current_user_role() <> 'staff' then
    raise exception 'forbidden';
  end if;
  select request_type into v_request_type from public.profiles where id = v_user_id;
  if v_request_type <> 'flex' then
    raise exception 'request_type_mismatch';
  end if;
  if date_in_week is null then
    raise exception 'date_required';
  end if;
  if p_requested_hours is null or p_requested_hours <= 0 then
    raise exception 'invalid_hours';
  end if;
  if p_requested_hours > 40 then
    raise exception 'max_hours';
  end if;

  select * into v_before from public.shift_requests
    where id = request_id
      and user_id = v_user_id
      and type = 'flex'
      and status = 'pending'
    for update;
  if not found then
    raise exception 'not_found_or_forbidden';
  end if;

  v_iso_year := to_char(date_in_week, 'IYYY')::int;
  v_iso_week := to_char(date_in_week, 'IW')::int;
  v_week_start := date_trunc('week', date_in_week)::date;
  v_current_week_start := date_trunc('week', (now() at time zone 'Asia/Tokyo')::date)::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;

  if v_week_start < v_current_week_start then
    raise exception 'past_week_not_allowed';
  end if;
  if date_in_week > v_max_date then
    raise exception 'max_lead_time';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = v_user_id
      and r.type = 'flex'
      and r.status in ('pending','approved')
      and r.iso_year = v_iso_year
      and r.iso_week = v_iso_week
      and r.id <> request_id
  ) then
    raise exception 'flex_duplicate_week';
  end if;

  update public.shift_requests
    set iso_year = v_iso_year,
        iso_week = v_iso_week,
        week_start_date = v_week_start,
        requested_hours = p_requested_hours,
        note = p_note
  where id = request_id
  ;

  perform private.log_shift_request_history(
    request_id,
    'update',
    v_user_id,
    v_before.status,
    v_before.status,
    v_before.decision_type,
    v_before.decision_type,
    jsonb_build_object(
      'type', 'flex',
      'before_iso_year', v_before.iso_year,
      'before_iso_week', v_before.iso_week,
      'before_week_start_date', v_before.week_start_date,
      'before_requested_hours', v_before.requested_hours,
      'after_iso_year', v_iso_year,
      'after_iso_week', v_iso_week,
      'after_week_start_date', v_week_start,
      'after_requested_hours', p_requested_hours,
      'before_note', v_before.note,
      'after_note', p_note
    )
  );
end;
$$;

drop function if exists private.reopen_flex_request(uuid, date, numeric, text);
create or replace function private.reopen_flex_request(request_id uuid, date_in_week date, p_requested_hours numeric, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_type text;
  v_iso_year int;
  v_iso_week int;
  v_week_start date;
  v_current_week_start date;
  v_max_date date;
  v_before public.shift_requests;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.current_user_role() <> 'staff' then
    raise exception 'forbidden';
  end if;
  select request_type into v_request_type from public.profiles where id = v_user_id;
  if v_request_type <> 'flex' then
    raise exception 'request_type_mismatch';
  end if;
  if date_in_week is null then
    raise exception 'date_required';
  end if;
  if p_requested_hours is null or p_requested_hours <= 0 then
    raise exception 'invalid_hours';
  end if;
  if p_requested_hours > 40 then
    raise exception 'max_hours';
  end if;

  select * into v_before from public.shift_requests
    where id = request_id
      and user_id = v_user_id
      and type = 'flex'
      and status = 'approved'
    for update;
  if not found then
    raise exception 'not_found_or_forbidden';
  end if;

  v_iso_year := to_char(date_in_week, 'IYYY')::int;
  v_iso_week := to_char(date_in_week, 'IW')::int;
  v_week_start := date_trunc('week', date_in_week)::date;
  v_current_week_start := date_trunc('week', (now() at time zone 'Asia/Tokyo')::date)::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;

  if v_week_start < v_current_week_start then
    raise exception 'past_week_not_allowed';
  end if;
  if date_in_week > v_max_date then
    raise exception 'max_lead_time';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = v_user_id
      and r.type = 'flex'
      and r.status in ('pending','approved')
      and r.iso_year = v_iso_year
      and r.iso_week = v_iso_week
      and r.id <> request_id
  ) then
    raise exception 'flex_duplicate_week';
  end if;

  update public.shift_requests
    set status = 'pending',
        decision_type = null,
        reviewer_note = null,
        reviewed_by = null,
        reviewed_at = null,
        approved_hours = null,
        iso_year = v_iso_year,
        iso_week = v_iso_week,
        week_start_date = v_week_start,
        requested_hours = p_requested_hours,
        note = p_note
  where id = request_id;

  perform private.log_shift_request_history(
    request_id,
    'reopen',
    v_user_id,
    v_before.status,
    'pending',
    v_before.decision_type,
    null,
    jsonb_build_object(
      'type', 'flex',
      'before_iso_year', v_before.iso_year,
      'before_iso_week', v_before.iso_week,
      'before_week_start_date', v_before.week_start_date,
      'before_requested_hours', v_before.requested_hours,
      'before_approved_hours', v_before.approved_hours,
      'after_iso_year', v_iso_year,
      'after_iso_week', v_iso_week,
      'after_week_start_date', v_week_start,
      'after_requested_hours', p_requested_hours,
      'before_note', v_before.note,
      'after_note', p_note
    )
  );
end;
$$;

drop function if exists private.withdraw_request(uuid, text);
create or replace function private.withdraw_request(request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.shift_requests;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if private.current_user_role() <> 'staff' then
    raise exception 'forbidden';
  end if;

  select * into v_req from public.shift_requests
  where id = request_id
    and user_id = v_user_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'not_found_or_forbidden';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required';
  end if;

  update public.shift_requests
    set status = 'withdrawn',
        reviewer_note = p_reason
  where id = request_id;

  perform private.log_shift_request_history(
    request_id,
    'withdraw',
    v_user_id,
    v_req.status,
    'withdrawn',
    v_req.decision_type,
    v_req.decision_type,
    jsonb_build_object(
      'type', v_req.type,
      'cancel_reason', p_reason,
      'reviewer_note', p_reason
    )
  );
end;
$$;

create or replace function private.review_fix_request(
  request_id uuid,
  p_decision_type text,
  p_approved_start_at timestamptz,
  p_approved_end_at timestamptz,
  p_change_reason text,
  p_reviewer_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role();
  v_req public.shift_requests;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if v_role not in ('admin','reviewer') then
    raise exception 'forbidden';
  end if;

  select * into v_req from public.shift_requests
    where id = request_id and type = 'fix' and status in ('pending','approved')
    for update;

  if not found then
    raise exception 'not_found';
  end if;

  if p_decision_type not in ('approve','modify','reject') then
    raise exception 'invalid_decision';
  end if;

  if p_decision_type = 'reject' then
    update public.shift_requests
      set status = 'rejected',
          decision_type = 'reject',
          reviewer_note = p_reviewer_note,
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          approved_start_at = null,
          approved_end_at = null,
          change_reason = null
    where id = request_id;

    perform private.log_shift_request_history(
      request_id,
      'review',
      auth.uid(),
      v_req.status,
      'rejected',
      v_req.decision_type,
      'reject',
      jsonb_build_object(
        'type', 'fix',
        'reviewer_note', p_reviewer_note
      )
    );
    return;
  end if;

  if p_decision_type = 'approve' then
    v_start := v_req.requested_start_at;
    v_end := v_req.requested_end_at;
  else
    if p_approved_start_at is null or p_approved_end_at is null then
      raise exception 'approved_times_required';
    end if;
    if p_change_reason is null or length(trim(p_change_reason)) = 0 then
      raise exception 'change_reason_required';
    end if;
    v_start := p_approved_start_at;
    v_end := p_approved_end_at;
  end if;

  if v_start >= v_end then
    raise exception 'invalid_time_range';
  end if;
  if v_end - v_start > interval '8 hours' then
    raise exception 'max_hours';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = v_req.user_id
      and r.type = 'fix'
      and r.status in ('pending','approved')
      and r.id <> request_id
      and tstzrange(coalesce(r.approved_start_at, r.requested_start_at),
                    coalesce(r.approved_end_at, r.requested_end_at), '[)')
          && tstzrange(v_start, v_end, '[)')
  ) then
    raise exception 'overlap';
  end if;

  update public.shift_requests
    set status = 'approved',
        decision_type = p_decision_type,
        approved_start_at = v_start,
        approved_end_at = v_end,
        change_reason = case when p_decision_type = 'modify' then p_change_reason else null end,
        reviewer_note = p_reviewer_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
  where id = request_id;

  perform private.log_shift_request_history(
    request_id,
    'review',
    auth.uid(),
    v_req.status,
    'approved',
    v_req.decision_type,
    p_decision_type,
    jsonb_build_object(
      'type', 'fix',
      'approved_start_at', v_start,
      'approved_end_at', v_end,
      'change_reason', case when p_decision_type = 'modify' then p_change_reason else null end,
      'reviewer_note', p_reviewer_note
    )
  );
end;
$$;

create or replace function private.review_flex_request(
  request_id uuid,
  p_decision_type text,
  p_approved_hours numeric,
  p_reviewer_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role();
  v_req public.shift_requests;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if v_role not in ('admin','reviewer') then
    raise exception 'forbidden';
  end if;

  select * into v_req from public.shift_requests
    where id = request_id and type = 'flex' and status in ('pending','approved')
    for update;

  if not found then
    raise exception 'not_found';
  end if;

  if p_decision_type not in ('approve','modify','partial','reject') then
    raise exception 'invalid_decision';
  end if;

  if p_decision_type = 'approve' then
    if v_req.requested_hours > 40 then
      raise exception 'max_hours';
    end if;
    update public.shift_requests
      set status = 'approved',
          decision_type = 'approve',
          approved_hours = v_req.requested_hours,
          reviewer_note = p_reviewer_note,
          reviewed_by = auth.uid(),
          reviewed_at = now()
    where id = request_id;

    perform private.log_shift_request_history(
      request_id,
      'review',
      auth.uid(),
      v_req.status,
      'approved',
      v_req.decision_type,
      'approve',
      jsonb_build_object(
        'type', 'flex',
        'approved_hours', v_req.requested_hours,
        'reviewer_note', p_reviewer_note
      )
    );
    return;
  end if;

  if p_decision_type in ('modify', 'partial') then
    if p_approved_hours is null or p_approved_hours <= 0 or p_approved_hours = v_req.requested_hours then
      raise exception 'invalid_hours';
    end if;
    if p_approved_hours > 40 then
      raise exception 'max_hours';
    end if;
    update public.shift_requests
      set status = 'approved',
          decision_type = 'modify',
          approved_hours = p_approved_hours,
          reviewer_note = p_reviewer_note,
          reviewed_by = auth.uid(),
          reviewed_at = now()
    where id = request_id;

    perform private.log_shift_request_history(
      request_id,
      'review',
      auth.uid(),
      v_req.status,
      'approved',
      v_req.decision_type,
      'modify',
      jsonb_build_object(
        'type', 'flex',
        'approved_hours', p_approved_hours,
        'reviewer_note', p_reviewer_note
      )
    );
    return;
  end if;

  update public.shift_requests
    set status = 'rejected',
        decision_type = 'reject',
        approved_hours = null,
        reviewer_note = p_reviewer_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
  where id = request_id;

  perform private.log_shift_request_history(
    request_id,
    'review',
    auth.uid(),
    v_req.status,
    'rejected',
    v_req.decision_type,
    'reject',
    jsonb_build_object(
      'type', 'flex',
      'reviewer_note', p_reviewer_note
    )
  );
end;
$$;

drop function if exists private.cancel_approved_request(uuid, text);
create or replace function private.cancel_approved_request(request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role();
  v_req public.shift_requests;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if v_role not in ('admin','reviewer','staff') then
    raise exception 'forbidden';
  end if;

  select * into v_req from public.shift_requests
    where id = request_id
      and status = 'approved'
    for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_role = 'staff' and v_req.user_id <> auth.uid() then
    raise exception 'forbidden';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required';
  end if;

  update public.shift_requests
    set status = 'withdrawn',
        decision_type = null,
        reviewer_note = p_reason,
        reviewed_by = null,
        reviewed_at = null,
        change_reason = null,
        approved_start_at = null,
        approved_end_at = null,
        approved_hours = null
  where id = request_id;

  perform private.log_shift_request_history(
    request_id,
    'reopen',
    auth.uid(),
    v_req.status,
    'withdrawn',
    v_req.decision_type,
    null,
    jsonb_build_object(
      'type', v_req.type,
      'approved_start_at', v_req.approved_start_at,
      'approved_end_at', v_req.approved_end_at,
      'approved_hours', v_req.approved_hours,
      'cancel_reason', p_reason,
      'reviewer_note', p_reason
    )
  );
end;
$$;

-- Backfill: old "確定キャンセル" records used to move approved -> pending.
-- Normalize them to withdrawn so they are not editable anymore.
with latest_history as (
  select distinct on (h.request_id)
    h.request_id,
    h.action,
    h.to_status
  from public.shift_request_histories h
  order by h.request_id, h.created_at desc
)
update public.shift_requests r
set status = 'withdrawn',
    decision_type = null,
    reviewer_note = null,
    reviewed_by = null,
    reviewed_at = null,
    change_reason = null,
    approved_start_at = null,
    approved_end_at = null,
    approved_hours = null
from latest_history lh
where r.id = lh.request_id
  and r.status = 'pending'
  and lh.action = 'reopen'
  and coalesce(lh.to_status, '') = 'pending';

create or replace function private.proxy_create_fix_request(
  user_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role();
  v_target_type text;
  v_start_jst timestamp;
  v_today_jst date;
  v_max_date date;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if v_role not in ('admin','reviewer') then
    raise exception 'forbidden';
  end if;
  if start_at is null or end_at is null then
    raise exception 'start_end_required';
  end if;
  if start_at >= end_at then
    raise exception 'invalid_time_range';
  end if;
  if end_at - start_at > interval '8 hours' then
    raise exception 'max_hours';
  end if;

  select request_type into v_target_type
  from public.profiles
  where id = proxy_create_fix_request.user_id;
  if v_target_type <> 'fix' then
    raise exception 'request_type_mismatch';
  end if;

  v_start_jst := start_at at time zone 'Asia/Tokyo';
  v_today_jst := (now() at time zone 'Asia/Tokyo')::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;
  if v_start_jst::date < v_today_jst then
    raise exception 'past_not_allowed';
  end if;
  if v_start_jst::date > v_max_date then
    raise exception 'max_lead_time';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = proxy_create_fix_request.user_id
      and r.type = 'fix'
      and r.status in ('pending','approved')
      and tstzrange(coalesce(r.approved_start_at, r.requested_start_at),
                    coalesce(r.approved_end_at, r.requested_end_at), '[)')
          && tstzrange(start_at, end_at, '[)')
  ) then
    raise exception 'overlap';
  end if;

  insert into public.shift_requests (
    user_id, created_by, type, status, note,
    decision_type, requested_start_at, requested_end_at,
    approved_start_at, approved_end_at,
    reviewed_by, reviewed_at
  ) values (
    proxy_create_fix_request.user_id, auth.uid(), 'fix', 'approved', note,
    'approve', start_at, end_at,
    start_at, end_at,
    auth.uid(), now()
  ) returning id into v_id;

  perform private.log_shift_request_history(
    v_id,
    'proxy_create',
    auth.uid(),
    null,
    'approved',
    null,
    'approve',
    jsonb_build_object(
      'type', 'fix',
      'requested_start_at', start_at,
      'requested_end_at', end_at,
      'approved_start_at', start_at,
      'approved_end_at', end_at,
      'note', note
    )
  );

  return v_id;
end;
$$;

create or replace function private.proxy_create_flex_request(
  user_id uuid,
  date_in_week date,
  requested_hours numeric,
  note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role();
  v_target_type text;
  v_iso_year int;
  v_iso_week int;
  v_week_start date;
  v_current_week_start date;
  v_max_date date;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if v_role not in ('admin','reviewer') then
    raise exception 'forbidden';
  end if;
  if date_in_week is null then
    raise exception 'date_required';
  end if;
  if requested_hours is null or requested_hours <= 0 then
    raise exception 'invalid_hours';
  end if;
  if requested_hours > 40 then
    raise exception 'max_hours';
  end if;

  select request_type into v_target_type
  from public.profiles
  where id = proxy_create_flex_request.user_id;
  if v_target_type <> 'flex' then
    raise exception 'request_type_mismatch';
  end if;

  v_iso_year := to_char(date_in_week, 'IYYY')::int;
  v_iso_week := to_char(date_in_week, 'IW')::int;
  v_week_start := date_trunc('week', date_in_week)::date;
  v_current_week_start := date_trunc('week', (now() at time zone 'Asia/Tokyo')::date)::date;
  v_max_date := ((now() at time zone 'Asia/Tokyo')::date + interval '3 months')::date;

  if v_week_start < v_current_week_start then
    raise exception 'past_week_not_allowed';
  end if;
  if date_in_week > v_max_date then
    raise exception 'max_lead_time';
  end if;

  if exists (
    select 1 from public.shift_requests r
    where r.user_id = proxy_create_flex_request.user_id
      and r.type = 'flex'
      and r.status in ('pending','approved')
      and r.iso_year = v_iso_year
      and r.iso_week = v_iso_week
  ) then
    raise exception 'flex_duplicate_week';
  end if;

  insert into public.shift_requests (
    user_id, created_by, type, status, note,
    decision_type, iso_year, iso_week, week_start_date, requested_hours, approved_hours,
    reviewed_by, reviewed_at
  ) values (
    proxy_create_flex_request.user_id, auth.uid(), 'flex', 'approved', note,
    'approve', v_iso_year, v_iso_week, v_week_start, requested_hours, requested_hours,
    auth.uid(), now()
  ) returning id into v_id;

  perform private.log_shift_request_history(
    v_id,
    'proxy_create',
    auth.uid(),
    null,
    'approved',
    null,
    'approve',
    jsonb_build_object(
      'type', 'flex',
      'iso_year', v_iso_year,
      'iso_week', v_iso_week,
      'week_start_date', v_week_start,
      'requested_hours', requested_hours,
      'approved_hours', requested_hours,
      'note', note
    )
  );

  return v_id;
end;
$$;

-- ==== Public API wrappers (SECURITY INVOKER) ====
create or replace function public.current_user_role()
returns text
language sql
stable
set search_path = ''
as $$
  select private.current_user_role();
$$;

create or replace function public.get_audit_logs(
  p_limit int default 100,
  p_offset int default 0,
  p_action text default null,
  p_actor text default null,
  p_email text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  ip_address text,
  action text,
  actor_id text,
  actor_username text,
  log_type text,
  traits json,
  payload json
)
language sql
stable
set search_path = ''
as $$
  select *
  from private.get_audit_logs(
    p_limit => p_limit,
    p_offset => p_offset,
    p_action => p_action,
    p_actor => p_actor,
    p_email => p_email
  );
$$;

create or replace function public.request_fix(start_at timestamptz, end_at timestamptz, note text)
returns uuid
language sql
set search_path = ''
as $$
  select private.request_fix(start_at, end_at, note);
$$;

create or replace function public.update_fix_request(request_id uuid, start_at timestamptz, end_at timestamptz, p_note text)
returns void
language sql
set search_path = ''
as $$
  select private.update_fix_request(request_id, start_at, end_at, p_note);
$$;

create or replace function public.reopen_fix_request(request_id uuid, start_at timestamptz, end_at timestamptz, p_note text)
returns void
language sql
set search_path = ''
as $$
  select private.reopen_fix_request(request_id, start_at, end_at, p_note);
$$;

create or replace function public.request_flex(date_in_week date, requested_hours numeric, note text)
returns uuid
language sql
set search_path = ''
as $$
  select private.request_flex(date_in_week, requested_hours, note);
$$;

create or replace function public.update_flex_request(request_id uuid, date_in_week date, p_requested_hours numeric, p_note text)
returns void
language sql
set search_path = ''
as $$
  select private.update_flex_request(request_id, date_in_week, p_requested_hours, p_note);
$$;

create or replace function public.reopen_flex_request(request_id uuid, date_in_week date, p_requested_hours numeric, p_note text)
returns void
language sql
set search_path = ''
as $$
  select private.reopen_flex_request(request_id, date_in_week, p_requested_hours, p_note);
$$;

create or replace function public.withdraw_request(request_id uuid, p_reason text)
returns void
language sql
set search_path = ''
as $$
  select private.withdraw_request(request_id, p_reason);
$$;

create or replace function public.review_fix_request(
  request_id uuid,
  p_decision_type text,
  p_approved_start_at timestamptz,
  p_approved_end_at timestamptz,
  p_change_reason text,
  p_reviewer_note text
)
returns void
language sql
set search_path = ''
as $$
  select private.review_fix_request(
    request_id,
    p_decision_type,
    p_approved_start_at,
    p_approved_end_at,
    p_change_reason,
    p_reviewer_note
  );
$$;

create or replace function public.review_flex_request(
  request_id uuid,
  p_decision_type text,
  p_approved_hours numeric,
  p_reviewer_note text
)
returns void
language sql
set search_path = ''
as $$
  select private.review_flex_request(request_id, p_decision_type, p_approved_hours, p_reviewer_note);
$$;

create or replace function public.cancel_approved_request(request_id uuid, p_reason text)
returns void
language sql
set search_path = ''
as $$
  select private.cancel_approved_request(request_id, p_reason);
$$;

create or replace function public.proxy_create_fix_request(
  user_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  note text
)
returns uuid
language sql
set search_path = ''
as $$
  select private.proxy_create_fix_request(user_id, start_at, end_at, note);
$$;

create or replace function public.proxy_create_flex_request(
  user_id uuid,
  date_in_week date,
  requested_hours numeric,
  note text
)
returns uuid
language sql
set search_path = ''
as $$
  select private.proxy_create_flex_request(user_id, date_in_week, requested_hours, note);
$$;

-- Function privilege hardening
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_role() from anon;
grant execute on function public.current_user_role() to authenticated, service_role;

revoke all on function public.request_fix(timestamptz, timestamptz, text) from public;
revoke all on function public.request_fix(timestamptz, timestamptz, text) from anon;
grant execute on function public.request_fix(timestamptz, timestamptz, text) to authenticated, service_role;

revoke all on function public.update_fix_request(uuid, timestamptz, timestamptz, text) from public;
revoke all on function public.update_fix_request(uuid, timestamptz, timestamptz, text) from anon;
grant execute on function public.update_fix_request(uuid, timestamptz, timestamptz, text) to authenticated, service_role;

revoke all on function public.reopen_fix_request(uuid, timestamptz, timestamptz, text) from public;
revoke all on function public.reopen_fix_request(uuid, timestamptz, timestamptz, text) from anon;
grant execute on function public.reopen_fix_request(uuid, timestamptz, timestamptz, text) to authenticated, service_role;

revoke all on function public.request_flex(date, numeric, text) from public;
revoke all on function public.request_flex(date, numeric, text) from anon;
grant execute on function public.request_flex(date, numeric, text) to authenticated, service_role;

revoke all on function public.update_flex_request(uuid, date, numeric, text) from public;
revoke all on function public.update_flex_request(uuid, date, numeric, text) from anon;
grant execute on function public.update_flex_request(uuid, date, numeric, text) to authenticated, service_role;

revoke all on function public.reopen_flex_request(uuid, date, numeric, text) from public;
revoke all on function public.reopen_flex_request(uuid, date, numeric, text) from anon;
grant execute on function public.reopen_flex_request(uuid, date, numeric, text) to authenticated, service_role;

revoke all on function public.withdraw_request(uuid, text) from public;
revoke all on function public.withdraw_request(uuid, text) from anon;
grant execute on function public.withdraw_request(uuid, text) to authenticated, service_role;

revoke all on function public.review_fix_request(uuid, text, timestamptz, timestamptz, text, text) from public;
revoke all on function public.review_fix_request(uuid, text, timestamptz, timestamptz, text, text) from anon;
grant execute on function public.review_fix_request(uuid, text, timestamptz, timestamptz, text, text) to authenticated, service_role;

revoke all on function public.review_flex_request(uuid, text, numeric, text) from public;
revoke all on function public.review_flex_request(uuid, text, numeric, text) from anon;
grant execute on function public.review_flex_request(uuid, text, numeric, text) to authenticated, service_role;

revoke all on function public.cancel_approved_request(uuid, text) from public;
revoke all on function public.cancel_approved_request(uuid, text) from anon;
grant execute on function public.cancel_approved_request(uuid, text) to authenticated, service_role;

revoke all on function public.proxy_create_fix_request(uuid, timestamptz, timestamptz, text) from public;
revoke all on function public.proxy_create_fix_request(uuid, timestamptz, timestamptz, text) from anon;
grant execute on function public.proxy_create_fix_request(uuid, timestamptz, timestamptz, text) to authenticated, service_role;

revoke all on function public.proxy_create_flex_request(uuid, date, numeric, text) from public;
revoke all on function public.proxy_create_flex_request(uuid, date, numeric, text) from anon;
grant execute on function public.proxy_create_flex_request(uuid, date, numeric, text) to authenticated, service_role;

revoke all on function public.get_audit_logs(int, int, text, text, text) from public;
revoke all on function public.get_audit_logs(int, int, text, text, text) from anon, authenticated;
grant execute on function public.get_audit_logs(int, int, text, text, text) to service_role;

revoke all on function private.get_audit_logs(int, int, text, text, text) from public;
revoke all on function private.get_audit_logs(int, int, text, text, text) from anon, authenticated;
grant execute on function private.get_audit_logs(int, int, text, text, text) to service_role;
