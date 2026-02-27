-- Attendance schema and RPCs
-- 勤怠管理機能（20日締め運用対応）

-- ==== Tables ====

-- 勤怠セッション（出勤〜退勤の1つの単位）
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  tasks text[] not null default '{}',
  -- 20日締め境界で自動分割されたセッションかどうか
  split_by_closing_boundary boolean not null default false,
  -- 前日からの継続セッションかどうか
  continued_from_closing_boundary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint attendance_sessions_end_after_start check (end_at is null or end_at > start_at)
);

create index if not exists attendance_sessions_user_id_idx on public.attendance_sessions(user_id);
create index if not exists attendance_sessions_start_at_idx on public.attendance_sessions(start_at desc);
create index if not exists attendance_sessions_user_start_idx on public.attendance_sessions(user_id, start_at desc);

-- 休憩記録
create table if not exists public.attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  created_at timestamptz not null default now(),

  constraint attendance_breaks_end_after_start check (end_at is null or end_at > start_at)
);

create index if not exists attendance_breaks_session_id_idx on public.attendance_breaks(session_id);

-- 管理者による修正履歴
create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  actor_role text not null check (actor_role in ('reviewer', 'admin')),
  message text not null,
  before_start_at timestamptz not null,
  before_end_at timestamptz,
  after_start_at timestamptz not null,
  after_end_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists attendance_corrections_session_id_idx on public.attendance_corrections(session_id);

-- ==== RLS Policies ====
alter table public.attendance_sessions enable row level security;
alter table public.attendance_breaks enable row level security;
alter table public.attendance_corrections enable row level security;

-- attendance_sessions: スタッフは自分のみ、reviewer/adminは全員
drop policy if exists "Users can view own attendance sessions" on public.attendance_sessions;
create policy "Users can view own attendance sessions" on public.attendance_sessions
  for select using (
    user_id = auth.uid()
    or private.current_user_role() in ('reviewer', 'admin')
  );

drop policy if exists "Users can insert own attendance sessions" on public.attendance_sessions;
create policy "Users can insert own attendance sessions" on public.attendance_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own attendance sessions" on public.attendance_sessions;
create policy "Users can update own attendance sessions" on public.attendance_sessions
  for update using (
    user_id = auth.uid()
    or private.current_user_role() in ('reviewer', 'admin')
  );

-- attendance_breaks: セッションの所有者またはreviewer/admin
drop policy if exists "Users can view attendance breaks" on public.attendance_breaks;
create policy "Users can view attendance breaks" on public.attendance_breaks
  for select using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id
        and (s.user_id = auth.uid() or private.current_user_role() in ('reviewer', 'admin'))
    )
  );

drop policy if exists "Users can insert attendance breaks" on public.attendance_breaks;
create policy "Users can insert attendance breaks" on public.attendance_breaks
  for insert with check (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update attendance breaks" on public.attendance_breaks;
create policy "Users can update attendance breaks" on public.attendance_breaks
  for update using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- attendance_corrections: reviewer/adminのみ閲覧・作成可
drop policy if exists "Reviewers can view corrections" on public.attendance_corrections;
create policy "Reviewers can view corrections" on public.attendance_corrections
  for select using (private.current_user_role() in ('reviewer', 'admin'));

drop policy if exists "Reviewers can insert corrections" on public.attendance_corrections;
create policy "Reviewers can insert corrections" on public.attendance_corrections
  for insert with check (private.current_user_role() in ('reviewer', 'admin'));


-- ==== Helper Functions ====

-- ユーザーの現在のオープンセッションを取得
create or replace function private.get_open_attendance_session(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.attendance_sessions
  where user_id = p_user_id and end_at is null
  order by start_at desc
  limit 1;
$$;

-- ユーザーの勤怠状態を取得（off / working / on_break）
create or replace function public.get_attendance_status(p_user_id uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_session_id uuid;
  v_has_open_break boolean;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    return 'off';
  end if;

  v_session_id := private.get_open_attendance_session(v_user_id);
  if v_session_id is null then
    return 'off';
  end if;

  select exists (
    select 1 from public.attendance_breaks
    where session_id = v_session_id and end_at is null
  ) into v_has_open_break;

  if v_has_open_break then
    return 'on_break';
  end if;

  return 'working';
end;
$$;


-- ==== RPC Functions ====

-- 出勤
create or replace function public.clock_in()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing uuid;
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_existing := private.get_open_attendance_session(v_user_id);
  if v_existing is not null then
    raise exception 'Already clocked in';
  end if;

  insert into public.attendance_sessions (user_id, start_at)
  values (v_user_id, now())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- 退勤
create or replace function public.clock_out(p_tasks text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_session_id := private.get_open_attendance_session(v_user_id);
  if v_session_id is null then
    raise exception 'Not clocked in';
  end if;

  -- オープンな休憩があれば自動終了
  update public.attendance_breaks
  set end_at = now()
  where session_id = v_session_id and end_at is null;

  update public.attendance_sessions
  set end_at = now(), tasks = p_tasks, updated_at = now()
  where id = v_session_id;
end;
$$;

-- 休憩開始
create or replace function public.break_start()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_existing uuid;
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_session_id := private.get_open_attendance_session(v_user_id);
  if v_session_id is null then
    raise exception 'Not clocked in';
  end if;

  select id into v_existing from public.attendance_breaks
  where session_id = v_session_id and end_at is null
  limit 1;

  if v_existing is not null then
    raise exception 'Already on break';
  end if;

  insert into public.attendance_breaks (session_id, start_at)
  values (v_session_id, now())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- 休憩終了
create or replace function public.break_end()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_break_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_session_id := private.get_open_attendance_session(v_user_id);
  if v_session_id is null then
    raise exception 'Not clocked in';
  end if;

  select id into v_break_id from public.attendance_breaks
  where session_id = v_session_id and end_at is null
  limit 1;

  if v_break_id is null then
    raise exception 'Not on break';
  end if;

  update public.attendance_breaks
  set end_at = now()
  where id = v_break_id;
end;
$$;

-- やったことを保存（勤務中のみ）
create or replace function public.save_current_tasks(p_tasks text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_session_id := private.get_open_attendance_session(v_user_id);
  if v_session_id is null then
    raise exception 'Not clocked in';
  end if;

  update public.attendance_sessions
  set tasks = p_tasks, updated_at = now()
  where id = v_session_id;
end;
$$;

-- 過去セッションのタスクを保存（自分のセッションのみ）
create or replace function public.save_session_tasks(p_session_id uuid, p_tasks text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select user_id into v_owner_id from public.attendance_sessions where id = p_session_id;
  if v_owner_id is null then
    raise exception 'Session not found';
  end if;
  if v_owner_id <> v_user_id then
    raise exception 'Not your session';
  end if;

  update public.attendance_sessions
  set tasks = p_tasks, updated_at = now()
  where id = p_session_id;
end;
$$;

-- 管理者による勤怠修正
create or replace function public.correct_attendance(
  p_session_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_before_start timestamptz;
  v_before_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_role := private.current_user_role();
  if v_role not in ('reviewer', 'admin') then
    raise exception 'Not authorized';
  end if;

  if p_message is null or trim(p_message) = '' then
    raise exception 'Message is required';
  end if;

  select start_at, end_at into v_before_start, v_before_end
  from public.attendance_sessions where id = p_session_id;

  if v_before_start is null then
    raise exception 'Session not found';
  end if;

  -- 修正履歴を記録
  insert into public.attendance_corrections (
    session_id, actor_id, actor_role, message,
    before_start_at, before_end_at, after_start_at, after_end_at
  ) values (
    p_session_id, v_user_id, v_role, p_message,
    v_before_start, v_before_end, p_start_at, p_end_at
  );

  -- セッションを更新
  update public.attendance_sessions
  set start_at = p_start_at, end_at = p_end_at, updated_at = now()
  where id = p_session_id;
end;
$$;

-- 期間指定で勤怠セッションを取得
create or replace function public.get_attendance_sessions(
  p_user_id uuid default null,
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  id uuid,
  user_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  tasks text[],
  split_by_closing_boundary boolean,
  continued_from_closing_boundary boolean,
  created_at timestamptz,
  updated_at timestamptz,
  breaks jsonb,
  corrections jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_user uuid := auth.uid();
  v_role text;
begin
  if v_current_user is null then
    raise exception 'Not authenticated';
  end if;

  v_role := private.current_user_role();

  return query
  select
    s.id,
    s.user_id,
    s.start_at,
    s.end_at,
    s.tasks,
    s.split_by_closing_boundary,
    s.continued_from_closing_boundary,
    s.created_at,
    s.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'start_at', b.start_at,
        'end_at', b.end_at
      ) order by b.start_at)
      from public.attendance_breaks b where b.session_id = s.id
    ), '[]'::jsonb) as breaks,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'actor_id', c.actor_id,
        'actor_role', c.actor_role,
        'message', c.message,
        'before_start_at', c.before_start_at,
        'before_end_at', c.before_end_at,
        'after_start_at', c.after_start_at,
        'after_end_at', c.after_end_at,
        'created_at', c.created_at
      ) order by c.created_at)
      from public.attendance_corrections c where c.session_id = s.id
    ), '[]'::jsonb) as corrections
  from public.attendance_sessions s
  where (p_user_id is null or s.user_id = p_user_id)
    and (s.user_id = v_current_user or v_role in ('reviewer', 'admin'))
    and (p_start_date is null or s.start_at >= (p_start_date::timestamptz at time zone 'Asia/Tokyo'))
    and (p_end_date is null or s.start_at < ((p_end_date + 1)::timestamptz at time zone 'Asia/Tokyo'))
  order by s.start_at desc;
end;
$$;


-- ==== Privilege Hardening ====
revoke all on function public.get_attendance_status(uuid) from public;
revoke all on function public.get_attendance_status(uuid) from anon;
grant execute on function public.get_attendance_status(uuid) to authenticated, service_role;

revoke all on function public.clock_in() from public;
revoke all on function public.clock_in() from anon;
grant execute on function public.clock_in() to authenticated, service_role;

revoke all on function public.clock_out(text[]) from public;
revoke all on function public.clock_out(text[]) from anon;
grant execute on function public.clock_out(text[]) to authenticated, service_role;

revoke all on function public.break_start() from public;
revoke all on function public.break_start() from anon;
grant execute on function public.break_start() to authenticated, service_role;

revoke all on function public.break_end() from public;
revoke all on function public.break_end() from anon;
grant execute on function public.break_end() to authenticated, service_role;

revoke all on function public.save_current_tasks(text[]) from public;
revoke all on function public.save_current_tasks(text[]) from anon;
grant execute on function public.save_current_tasks(text[]) to authenticated, service_role;

revoke all on function public.save_session_tasks(uuid, text[]) from public;
revoke all on function public.save_session_tasks(uuid, text[]) from anon;
grant execute on function public.save_session_tasks(uuid, text[]) to authenticated, service_role;

revoke all on function public.correct_attendance(uuid, timestamptz, timestamptz, text) from public;
revoke all on function public.correct_attendance(uuid, timestamptz, timestamptz, text) from anon;
grant execute on function public.correct_attendance(uuid, timestamptz, timestamptz, text) to authenticated, service_role;

revoke all on function public.get_attendance_sessions(uuid, date, date) from public;
revoke all on function public.get_attendance_sessions(uuid, date, date) from anon;
grant execute on function public.get_attendance_sessions(uuid, date, date) to authenticated, service_role;

revoke all on function private.get_open_attendance_session(uuid) from public;
grant execute on function private.get_open_attendance_session(uuid) to authenticated, service_role;

-- ==== Realtime ====
-- Supabase Realtimeで変更をブロードキャスト
alter publication supabase_realtime add table public.attendance_sessions;
alter publication supabase_realtime add table public.attendance_breaks;
