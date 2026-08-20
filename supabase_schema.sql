-- ============================================================================
-- GOODMINTON Supabase Auth + secure RLS schema repair
--
-- This script is idempotent and is intended for Supabase SQL Editor.
-- Security model:
--   * anon: no public table access
--   * approved member: read team data; write only their own open attendance,
--     match survey and payment report
--   * approved admin: full management access (multiple admins supported)
--   * expired activities and fee collections are enforced in RLS, not only UI
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Tables (new installations)
-- --------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text unique,
  name text not null,
  level text not null default '初級',
  role text not null default 'member',
  gender text not null default 'male',
  status text not null default 'pending',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  event_type text not null default '練球',
  location text default '羽球館',
  court_number text,
  fee numeric(10, 2) default 0,
  max_participants integer default 20,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'pending',
  remarks text,
  created_at timestamptz not null default now(),
  constraint unique_user_event unique (user_id, event_id)
);

create table if not exists public.match_surveys (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  preferred_disciplines text[] not null default '{}',
  partner_preference text,
  max_matches_desired integer default 1,
  notes text,
  updated_at timestamptz not null default now(),
  constraint unique_survey_user_event unique (event_id, user_id)
);

create table if not exists public.match_lineup_configs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  is_published boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.match_lineup_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  point_index integer not null,
  point_name text not null,
  discipline text not null,
  player_ids text[] not null default '{}',
  opponent_info text,
  score text,
  created_at timestamptz not null default now()
);

create table if not exists public.finances (
  id uuid primary key default gen_random_uuid(),
  move_date date not null default current_date,
  title text not null,
  type text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  remarks text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  c_type text not null default 'split',
  total_amount numeric(10, 2) default 0,
  amount_per_person numeric(10, 2) not null default 0,
  status text not null default 'active',
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_records (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.fee_collections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_paid boolean not null default false,
  payment_status text not null default 'unpaid',
  reported_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint unique_collection_user unique (collection_id, user_id)
);

-- --------------------------------------------------------------------------
-- 2. Repair older installations. CREATE TABLE IF NOT EXISTS never adds a
--    missing column to a table that already exists, so every client field is
--    reconciled explicitly here.
-- --------------------------------------------------------------------------

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists username text,
  add column if not exists name text,
  add column if not exists level text default '初級',
  add column if not exists role text default 'member',
  add column if not exists gender text default 'male',
  add column if not exists status text default 'pending',
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz default now();

-- Plain-text application passwords are obsolete and unsafe after Auth migration.
alter table public.profiles drop column if exists password;

update public.profiles
set
  username = coalesce(nullif(btrim(username), ''), 'user_' || substr(replace(id::text, '-', ''), 1, 8)),
  name = coalesce(nullif(btrim(name), ''), nullif(btrim(username), ''), '未命名隊員'),
  level = coalesce(nullif(btrim(level), ''), '初級'),
  role = coalesce(nullif(btrim(role), ''), 'member'),
  gender = coalesce(nullif(btrim(gender), ''), 'male'),
  status = coalesce(nullif(btrim(status), ''), case when role = 'admin' then 'approved' else 'pending' end),
  created_at = coalesce(created_at, now())
where username is null
   or name is null
   or level is null
   or role is null
   or gender is null
   or status is null
   or created_at is null;

alter table public.profiles
  alter column level set default '初級',
  alter column role set default 'member',
  alter column gender set default 'male',
  alter column status set default 'pending',
  alter column created_at set default now(),
  alter column name set not null,
  alter column level set not null,
  alter column role set not null,
  alter column gender set not null,
  alter column status set not null,
  alter column created_at set not null;

alter table public.events
  add column if not exists title text,
  add column if not exists event_date date,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists event_type text default '練球',
  add column if not exists location text default '羽球館',
  add column if not exists court_number text,
  add column if not exists fee numeric(10, 2) default 0,
  add column if not exists max_participants integer default 20,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

alter table public.attendance
  add column if not exists user_id uuid,
  add column if not exists event_id uuid,
  add column if not exists status text default 'pending',
  add column if not exists remarks text,
  add column if not exists created_at timestamptz default now();

alter table public.match_surveys
  add column if not exists event_id uuid,
  add column if not exists user_id uuid,
  add column if not exists preferred_disciplines text[] default '{}',
  add column if not exists partner_preference text,
  add column if not exists max_matches_desired integer default 1,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

alter table public.match_lineup_configs
  add column if not exists event_id uuid,
  add column if not exists is_published boolean default false,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

alter table public.match_lineup_slots
  add column if not exists event_id uuid,
  add column if not exists point_index integer,
  add column if not exists point_name text,
  add column if not exists discipline text,
  add column if not exists player_ids text[] default '{}',
  add column if not exists opponent_info text,
  add column if not exists score text,
  add column if not exists created_at timestamptz default now();

alter table public.finances
  add column if not exists move_date date default current_date,
  add column if not exists title text,
  add column if not exists type text,
  add column if not exists amount numeric(10, 2) default 0,
  add column if not exists remarks text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

alter table public.fee_collections
  add column if not exists title text,
  add column if not exists c_type text default 'split',
  add column if not exists total_amount numeric(10, 2) default 0,
  add column if not exists amount_per_person numeric(10, 2) default 0,
  add column if not exists status text default 'active',
  add column if not exists due_date date,
  add column if not exists created_at timestamptz default now();

alter table public.fee_records
  add column if not exists collection_id uuid,
  add column if not exists user_id uuid,
  add column if not exists is_paid boolean default false,
  add column if not exists payment_status text default 'unpaid',
  add column if not exists reported_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

-- Remove only the legacy profiles.id -> auth.users.id foreign key. The new
-- auth_user_id link is intentionally retained so profile IDs may stay custom.
do $repair$
declare
  fk record;
begin
  for fk in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and exists (
        select 1
        from unnest(c.conkey) as key(attnum)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = key.attnum
        where a.attname = 'id'
      )
  loop
    execute format('alter table public.profiles drop constraint %I', fk.conname);
  end loop;
end
$repair$;

-- Add the nullable Auth link without forcing legacy/custom profile IDs to be
-- Auth user IDs. Existing equal UUIDs are linked automatically.
do $repair$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and exists (
        select 1
        from unnest(c.conkey) as key(attnum)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = key.attnum
        where a.attname = 'auth_user_id'
      )
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end
$repair$;

update public.profiles p
set auth_user_id = p.id
where p.auth_user_id is null
  and exists (select 1 from auth.users u where u.id = p.id);

-- Support browser-generated UUIDs even when the row is not linked to Auth.
do $repair$
declare
  id_type text;
begin
  select data_type into id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'id';

  if id_type = 'uuid' then
    execute 'alter table public.profiles alter column id set default gen_random_uuid()';
  elsif id_type in ('text', 'character varying') then
    execute 'alter table public.profiles alter column id set default (gen_random_uuid()::text)';
  else
    raise exception 'Unsupported public.profiles.id type: %. Use uuid (recommended) or text.', id_type;
  end if;
end
$repair$;

-- Unique indexes used by supabase-js upsert(onConflict: ...).
-- If one of these fails, run supabase_diagnostics.sql and remove duplicate
-- logical rows before re-running this repair.
create unique index if not exists uq_profiles_username
  on public.profiles (username) where username is not null;
create unique index if not exists uq_profiles_username_ci
  on public.profiles (lower(username)) where username is not null;
create unique index if not exists uq_profiles_auth_user_id
  on public.profiles (auth_user_id) where auth_user_id is not null;
create unique index if not exists uq_attendance_user_event
  on public.attendance (user_id, event_id);
create unique index if not exists uq_match_surveys_event_user
  on public.match_surveys (event_id, user_id);
create unique index if not exists uq_match_lineup_configs_event
  on public.match_lineup_configs (event_id);
create unique index if not exists uq_fee_records_collection_user
  on public.fee_records (collection_id, user_id);

create index if not exists idx_events_date on public.events(event_date);
create index if not exists idx_attendance_event on public.attendance(event_id);
create index if not exists idx_attendance_user on public.attendance(user_id);
create index if not exists idx_match_surveys_event on public.match_surveys(event_id);
create index if not exists idx_match_surveys_user on public.match_surveys(user_id);
create index if not exists idx_match_lineup_slots_event on public.match_lineup_slots(event_id);
create index if not exists idx_finances_date on public.finances(move_date);
create index if not exists idx_fee_records_user on public.fee_records(user_id);
create index if not exists idx_fee_records_collection on public.fee_records(collection_id);

-- --------------------------------------------------------------------------
-- 3. Supabase Auth integration. Client metadata can set display fields only;
--    it can never self-assign admin/approved privileges.
-- --------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text;
  final_username text;
  display_name text;
begin
  requested_username := lower(btrim(coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, ''), '@', 1)
  )));

  if requested_username = '' then
    requested_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  final_username := requested_username;

  -- A duplicate display username must never abort creation of auth.users.
  -- Authentication uses a hashed internal Auth identity, so a deterministic
  -- race-condition suffix remains safe even for Unicode account names.
  if exists (
    select 1 from public.profiles p
    where lower(p.username) = final_username and p.id <> new.id
  ) then
    final_username := requested_username
      || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  if display_name is null then
    display_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), final_username);
  end if;

  insert into public.profiles as existing (
    id, auth_user_id, username, name, level, role, gender, status
  )
  values (
    new.id,
    new.id,
    final_username,
    display_name,
    coalesce(new.raw_user_meta_data ->> 'level', '初級'),
    'member',
    coalesce(new.raw_user_meta_data ->> 'gender', 'male'),
    'pending'
  )
  on conflict (id) do update set
    auth_user_id = new.id,
    username = coalesce(nullif(existing.username, ''), excluded.username),
    name = coalesce(nullif(existing.name, ''), excluded.name),
    level = coalesce(nullif(existing.level, ''), excluded.level),
    gender = coalesce(nullif(existing.gender, ''), excluded.gender);
  return new;
end
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.goodminton_username_is_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select btrim(coalesce(candidate, '')) <> ''
    and not exists (
      select 1 from public.profiles p
      where lower(p.username) = lower(btrim(candidate))
    )
$function$;

revoke all on function public.goodminton_username_is_available(text) from public;
grant execute on function public.goodminton_username_is_available(text) to anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 4. Production authorization. GRANT decides whether PostgREST can reach a
--    table; RLS decides which rows/actions an authenticated user may access.
-- --------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

revoke all on table
  public.profiles,
  public.events,
  public.attendance,
  public.match_surveys,
  public.match_lineup_configs,
  public.match_lineup_slots,
  public.finances,
  public.fee_collections,
  public.fee_records
from anon, public;

grant select, insert, update, delete on table
  public.profiles,
  public.events,
  public.attendance,
  public.match_surveys,
  public.match_lineup_configs,
  public.match_lineup_slots,
  public.finances,
  public.fee_collections,
  public.fee_records
to authenticated, service_role;

do $secure_policies$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'profiles', 'events', 'attendance', 'match_surveys',
    'match_lineup_configs', 'match_lineup_slots', 'finances',
    'fee_collections', 'fee_records'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    for policy_name in
      select pol.policyname
      from pg_policies pol
      where pol.schemaname = 'public' and pol.tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end
$secure_policies$;

create or replace function public.goodminton_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'approved'
  limit 1
$function$;

create or replace function public.goodminton_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'approved'
  )
$function$;

create or replace function public.goodminton_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'approved'
      and p.role = 'admin'
  )
$function$;

create or replace function public.goodminton_event_is_open(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.events e
    where e.id = target_event_id
      and (
        e.event_date
        + coalesce(e.end_time, e.start_time, time '23:59:59')
      ) >= (now() at time zone 'Asia/Taipei')
  )
$function$;

create or replace function public.goodminton_fee_is_open(target_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.fee_collections c
    where c.id = target_collection_id
      and c.status = 'active'
      and (c.due_date is null or c.due_date >= (now() at time zone 'Asia/Taipei')::date)
  )
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.goodminton_current_profile_id() from public, anon;
revoke all on function public.goodminton_is_approved() from public, anon;
revoke all on function public.goodminton_is_admin() from public, anon;
revoke all on function public.goodminton_event_is_open(uuid) from public, anon;
revoke all on function public.goodminton_fee_is_open(uuid) from public, anon;

grant execute on function public.goodminton_current_profile_id() to authenticated, service_role;
grant execute on function public.goodminton_is_approved() to authenticated, service_role;
grant execute on function public.goodminton_is_admin() to authenticated, service_role;
grant execute on function public.goodminton_event_is_open(uuid) to authenticated, service_role;
grant execute on function public.goodminton_fee_is_open(uuid) to authenticated, service_role;

-- Profiles: pending users may read only their own row; approved users may read
-- approved teammates; admins manage all rows. Own profile edits cannot escalate.
create policy profiles_read
  on public.profiles for select to authenticated
  using (
    auth.uid() = auth_user_id
    or public.goodminton_is_admin()
    or (public.goodminton_is_approved() and status = 'approved')
  );
create policy profiles_admin_insert
  on public.profiles for insert to authenticated
  with check (public.goodminton_is_admin());
create policy profiles_admin_update
  on public.profiles for update to authenticated
  using (public.goodminton_is_admin())
  with check (public.goodminton_is_admin());
create policy profiles_admin_delete
  on public.profiles for delete to authenticated
  using (public.goodminton_is_admin());
create policy profiles_own_update
  on public.profiles for update to authenticated
  using (auth.uid() = auth_user_id and status = 'approved')
  with check (auth.uid() = auth_user_id and status = 'approved');

create or replace function public.goodminton_protect_profile_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  is_system boolean := current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin');
  is_api_admin boolean := public.goodminton_is_admin();
begin
  if tg_op = 'DELETE' then
    if not is_system and auth.uid() = old.auth_user_id then
      raise exception 'You cannot delete your own active profile' using errcode = '42501';
    end if;
    if not is_system
       and old.role = 'admin' and old.status = 'approved' and old.auth_user_id is not null
       and not exists (
         select 1 from public.profiles p
         where p.id <> old.id and p.role = 'admin' and p.status = 'approved' and p.auth_user_id is not null
       ) then
      raise exception 'At least one linked approved administrator is required' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and not is_system then
    if not is_api_admin then
      if auth.uid() is null or auth.uid() <> old.auth_user_id then
        raise exception 'Profile update is not permitted' using errcode = '42501';
      end if;
      if new.id is distinct from old.id
         or new.auth_user_id is distinct from old.auth_user_id
         or new.role is distinct from old.role
         or new.status is distinct from old.status
         or new.created_at is distinct from old.created_at then
        raise exception 'Members cannot change identity, role or approval status' using errcode = '42501';
      end if;
    elsif auth.uid() = old.auth_user_id
       and (new.role is distinct from old.role
         or new.status is distinct from old.status
         or new.auth_user_id is distinct from old.auth_user_id) then
      raise exception 'Administrators cannot change their own authorization' using errcode = '42501';
    end if;

    if old.role = 'admin' and old.status = 'approved' and old.auth_user_id is not null
       and (new.role <> 'admin' or new.status <> 'approved' or new.auth_user_id is null)
       and not exists (
         select 1 from public.profiles p
         where p.id <> old.id and p.role = 'admin' and p.status = 'approved' and p.auth_user_id is not null
       ) then
      raise exception 'At least one linked approved administrator is required' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.goodminton_protect_profile_change() from public, anon, authenticated;
drop trigger if exists goodminton_protect_profile_change on public.profiles;
create trigger goodminton_protect_profile_change
  before update or delete on public.profiles
  for each row execute function public.goodminton_protect_profile_change();

-- Shared read access for approved team members; management is admin-only.
create policy events_read on public.events for select to authenticated using (public.goodminton_is_approved());
create policy events_admin_all on public.events for all to authenticated using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());
create policy finances_read on public.finances for select to authenticated using (public.goodminton_is_approved());
create policy finances_admin_all on public.finances for all to authenticated using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());
create policy fee_collections_read on public.fee_collections for select to authenticated using (public.goodminton_is_approved());
create policy fee_collections_admin_all on public.fee_collections for all to authenticated using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());
create policy lineup_configs_read on public.match_lineup_configs for select to authenticated using (public.goodminton_is_approved());
create policy lineup_configs_admin_all on public.match_lineup_configs for all to authenticated using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());
create policy lineup_slots_read on public.match_lineup_slots for select to authenticated using (public.goodminton_is_approved());
create policy lineup_slots_admin_all on public.match_lineup_slots for all to authenticated using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());

-- Attendance and surveys remain writable by a member only for themselves and
-- only before the activity end time. Admins may manage them at any time.
create policy attendance_read on public.attendance for select to authenticated using (public.goodminton_is_approved());
create policy attendance_admin_all on public.attendance for all to authenticated using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());
create policy attendance_member_insert on public.attendance for insert to authenticated
  with check (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id));
create policy attendance_member_update on public.attendance for update to authenticated
  using (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id))
  with check (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id));
create policy attendance_member_delete on public.attendance for delete to authenticated
  using (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id));

create policy match_surveys_read on public.match_surveys for select to authenticated using (public.goodminton_is_approved());
create policy match_surveys_admin_all on public.match_surveys for all to authenticated using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());
create policy match_surveys_member_insert on public.match_surveys for insert to authenticated
  with check (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id));
create policy match_surveys_member_update on public.match_surveys for update to authenticated
  using (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id))
  with check (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id));
create policy match_surveys_member_delete on public.match_surveys for delete to authenticated
  using (user_id = public.goodminton_current_profile_id() and public.goodminton_event_is_open(event_id));

-- Members see and report only their own fee row. is_paid/paid_at remain admin-only.
create policy fee_records_admin_all on public.fee_records for all to authenticated
  using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());
create policy fee_records_member_read on public.fee_records for select to authenticated
  using (user_id = public.goodminton_current_profile_id());
create policy fee_records_member_update on public.fee_records for update to authenticated
  using (user_id = public.goodminton_current_profile_id() and public.goodminton_fee_is_open(collection_id))
  with check (user_id = public.goodminton_current_profile_id() and public.goodminton_fee_is_open(collection_id));

create or replace function public.goodminton_protect_fee_record_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') or public.goodminton_is_admin() then
    return new;
  end if;
  if auth.uid() is null or old.user_id <> public.goodminton_current_profile_id() then
    raise exception 'Payment report is not owned by the current member' using errcode = '42501';
  end if;
  if not public.goodminton_fee_is_open(old.collection_id) then
    raise exception 'Payment collection is closed or past due' using errcode = '42501';
  end if;
  if new.id is distinct from old.id
     or new.collection_id is distinct from old.collection_id
     or new.user_id is distinct from old.user_id
     or new.is_paid is distinct from old.is_paid
     or new.paid_at is distinct from old.paid_at
     or new.created_at is distinct from old.created_at
     or new.payment_status not in ('unpaid', 'pending') then
    raise exception 'Members may only submit or cancel their own payment report' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.goodminton_protect_fee_record_change() from public, anon, authenticated;
drop trigger if exists goodminton_protect_fee_record_change on public.fee_records;
create trigger goodminton_protect_fee_record_change
  before update on public.fee_records
  for each row execute function public.goodminton_protect_fee_record_change();

-- --------------------------------------------------------------------------
-- 5. Supabase Realtime replication.
--    Without this publication membership, postgres_changes subscriptions can
--    connect successfully but never receive profile/payment/table updates.
-- --------------------------------------------------------------------------

do $realtime$
declare
  table_name text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  foreach table_name in array array[
    'profiles',
    'events',
    'attendance',
    'match_surveys',
    'match_lineup_configs',
    'match_lineup_slots',
    'finances',
    'fee_collections',
    'fee_records'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$realtime$;

commit;

-- Force PostgREST to recognize added columns/tables/functions immediately.
notify pgrst, 'reload schema';
select pg_notification_queue_usage() as notification_queue_usage;

-- Expected result: one row with a small queue usage value, normally 0.
-- Then re-run the failed browser request and confirm a 2xx response.
