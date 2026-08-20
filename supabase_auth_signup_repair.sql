-- GOODMINTON Supabase Auth signup trigger repair
-- Run in Supabase SQL Editor when the browser reports:
--   Database error saving new user

begin;

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists username text,
  add column if not exists name text,
  add column if not exists level text default '初級',
  add column if not exists role text default 'member',
  add column if not exists gender text default 'male',
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now();

-- Old custom-login schemas often require this column even though the Auth
-- trigger never writes it. Removing it fixes the common NOT NULL failure and
-- prevents plain-text password storage.
alter table public.profiles drop column if exists password;

create unique index if not exists uq_profiles_auth_user_id
  on public.profiles (auth_user_id) where auth_user_id is not null;
create unique index if not exists uq_profiles_username_ci
  on public.profiles (lower(username)) where username is not null;

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
  ) values (
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

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.goodminton_username_is_available(text) from public;
grant execute on function public.goodminton_username_is_available(text)
  to anon, authenticated, service_role;

commit;
notify pgrst, 'reload schema';

-- Expected: trigger_enabled = O and zero rows in unexpected_required_columns.
select
  t.tgenabled as trigger_enabled,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass
  and t.tgname = 'on_auth_user_created'
  and not t.tgisinternal;

select column_name as unexpected_required_column
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and is_nullable = 'NO'
  and column_default is null
  and column_name not in (
    'id', 'auth_user_id', 'username', 'name', 'level', 'role',
    'gender', 'status', 'created_at'
  );
