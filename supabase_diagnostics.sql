-- ============================================================================
-- GOODMINTON read-only Supabase diagnostics
-- Run each result section in Supabase SQL Editor. This file does not modify data.
-- ============================================================================

-- 1. Server/session identity. Dashboard queries normally run as postgres.
select
  current_database() as database_name,
  current_user as current_user,
  session_user as session_user,
  version() as postgres_version,
  current_setting('TimeZone') as timezone;

-- 2. Expected tables and RLS flags. A missing table has null values.
with expected(table_name) as (
  values
    ('profiles'), ('events'), ('attendance'), ('match_surveys'),
    ('match_lineup_configs'), ('match_lineup_slots'), ('finances'),
    ('fee_collections'), ('fee_records')
)
select
  e.table_name,
  c.oid is not null as table_exists,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from expected e
left join pg_namespace n on n.nspname = 'public'
left join pg_class c on c.relnamespace = n.oid
  and c.relname = e.table_name
  and c.relkind in ('r', 'p')
order by e.table_name;

-- 3. Actual columns, types, defaults and nullability.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles', 'events', 'attendance', 'match_surveys',
    'match_lineup_configs', 'match_lineup_slots', 'finances',
    'fee_collections', 'fee_records'
  )
order by table_name, ordinal_position;

-- 4. Missing client-required columns. Zero rows means the shape is complete.
with expected(table_name, column_name) as (
  values
    ('profiles','id'), ('profiles','auth_user_id'), ('profiles','username'), ('profiles','name'),
    ('profiles','level'), ('profiles','role'), ('profiles','gender'),
    ('profiles','status'), ('profiles','phone'), ('profiles','avatar_url'),
    ('profiles','created_at'),
    ('events','id'), ('events','title'), ('events','event_date'),
    ('events','start_time'), ('events','end_time'), ('events','event_type'),
    ('events','location'), ('events','court_number'), ('events','fee'),
    ('events','max_participants'), ('events','notes'), ('events','created_at'),
    ('attendance','id'), ('attendance','user_id'), ('attendance','event_id'),
    ('attendance','status'), ('attendance','remarks'), ('attendance','created_at'),
    ('finances','id'), ('finances','move_date'), ('finances','title'),
    ('finances','type'), ('finances','amount'), ('finances','remarks'),
    ('finances','created_by'), ('finances','created_at'),
    ('fee_collections','id'), ('fee_collections','title'),
    ('fee_collections','c_type'), ('fee_collections','total_amount'),
    ('fee_collections','amount_per_person'), ('fee_collections','status'),
    ('fee_collections','due_date'), ('fee_collections','created_at'),
    ('fee_records','id'), ('fee_records','collection_id'),
    ('fee_records','user_id'), ('fee_records','is_paid'),
    ('fee_records','payment_status'), ('fee_records','reported_at'),
    ('fee_records','paid_at'), ('fee_records','notes'),
    ('fee_records','created_at'),
    ('match_surveys','id'), ('match_surveys','event_id'),
    ('match_surveys','user_id'), ('match_surveys','preferred_disciplines'),
    ('match_surveys','partner_preference'),
    ('match_surveys','max_matches_desired'), ('match_surveys','notes'),
    ('match_surveys','updated_at'),
    ('match_lineup_configs','id'), ('match_lineup_configs','event_id'),
    ('match_lineup_configs','is_published'), ('match_lineup_configs','notes'),
    ('match_lineup_configs','updated_at'),
    ('match_lineup_slots','id'), ('match_lineup_slots','event_id'),
    ('match_lineup_slots','point_index'), ('match_lineup_slots','point_name'),
    ('match_lineup_slots','discipline'), ('match_lineup_slots','player_ids'),
    ('match_lineup_slots','opponent_info'), ('match_lineup_slots','score'),
    ('match_lineup_slots','created_at')
)
select e.table_name, e.column_name as missing_column
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
where c.column_name is null
order by e.table_name, e.column_name;

-- 5. Policies, including whether they are PERMISSIVE or RESTRICTIVE.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'events', 'attendance', 'match_surveys',
    'match_lineup_configs', 'match_lineup_slots', 'finances',
    'fee_collections', 'fee_records'
  )
order by tablename, policyname;

-- 6. Effective table grants for Data API roles.
select
  grantee,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
  and table_name in (
    'profiles', 'events', 'attendance', 'match_surveys',
    'match_lineup_configs', 'match_lineup_slots', 'finances',
    'fee_collections', 'fee_records'
  )
group by grantee, table_name
order by table_name, grantee;

-- 6b. Secure target: every anon_* value must be false; authenticated_* should
-- be true because RLS (not GRANT alone) performs the row/action filtering.
with expected(table_name) as (
  values
    ('profiles'), ('events'), ('attendance'), ('match_surveys'),
    ('match_lineup_configs'), ('match_lineup_slots'), ('finances'),
    ('fee_collections'), ('fee_records')
)
select
  table_name,
  case when to_regclass(format('public.%I', table_name)) is not null then has_table_privilege('anon', format('public.%I', table_name), 'SELECT') end as anon_can_select,
  case when to_regclass(format('public.%I', table_name)) is not null then has_table_privilege('anon', format('public.%I', table_name), 'INSERT') end as anon_can_insert,
  case when to_regclass(format('public.%I', table_name)) is not null then has_table_privilege('anon', format('public.%I', table_name), 'UPDATE') end as anon_can_update,
  case when to_regclass(format('public.%I', table_name)) is not null then has_table_privilege('anon', format('public.%I', table_name), 'DELETE') end as anon_can_delete,
  case when to_regclass(format('public.%I', table_name)) is not null then has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') end as authenticated_has_select_grant,
  case when to_regclass(format('public.%I', table_name)) is not null then has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT') end as authenticated_has_insert_grant
from expected
order by table_name;

-- 7. Foreign keys. profiles.auth_user_id -> auth.users.id is expected;
--    profiles.id -> auth.users.id is not. Child profile FKs are expected.
select
  con.conname as constraint_name,
  con.conrelid::regclass as source_table,
  pg_get_constraintdef(con.oid) as definition,
  con.confrelid::regclass as referenced_table
from pg_constraint con
where con.contype = 'f'
  and (
    con.conrelid = to_regclass('public.profiles')
    or con.confrelid = to_regclass('public.profiles')
    or con.conrelid = any(array[
      to_regclass('public.attendance'),
      to_regclass('public.match_surveys'),
      to_regclass('public.match_lineup_configs'),
      to_regclass('public.match_lineup_slots'),
      to_regclass('public.finances'),
      to_regclass('public.fee_records')
    ])
  )
order by con.conrelid::regclass::text, constraint_name;

-- 7b. Auth linkage and authorization readiness. Before locking down the app,
-- every person who must log in needs auth_link_state = LINKED. At least one
-- linked, approved admin is required.
select
  p.id,
  p.username,
  p.name,
  p.role,
  p.status,
  p.auth_user_id,
  case
    when p.auth_user_id is null then 'UNLINKED'
    when u.id is null then 'BROKEN_LINK'
    else 'LINKED'
  end as auth_link_state,
  u.email as auth_email
from public.profiles p
left join auth.users u on u.id = p.auth_user_id
order by p.role, p.status, p.username;

select
  count(*) filter (where role = 'admin' and status = 'approved' and auth_user_id is not null) as linked_approved_admins,
  count(*) filter (where auth_user_id is null) as unlinked_profiles,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'password'
  ) as unsafe_password_column_still_exists
from public.profiles;

-- 8. Constraints and indexes needed by upsert(onConflict: ...).
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles', 'attendance', 'match_surveys',
    'match_lineup_configs', 'fee_records'
  )
order by tablename, indexname;

-- 9. Logical duplicates that would block unique indexes/upserts.
-- Results are emitted in SQL Editor's Messages panel and missing tables are
-- skipped, so this diagnostic can run before the repair script.
do $diagnostics$
declare
  spec record;
  duplicates jsonb;
begin
  for spec in
    select * from (values
      ('profiles', 'lower(username) as normalized_username', 'lower(username)', 'username is not null'),
      ('attendance', 'user_id, event_id', 'user_id, event_id', 'true'),
      ('match_surveys', 'event_id, user_id', 'event_id, user_id', 'true'),
      ('match_lineup_configs', 'event_id', 'event_id', 'true'),
      ('fee_records', 'collection_id, user_id', 'collection_id, user_id', 'true')
    ) as checks(table_name, select_columns, group_columns, filter_expression)
  loop
    if to_regclass(format('public.%I', spec.table_name)) is null then
      raise notice '%: table missing', spec.table_name;
    else
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(d)), ''[]''::jsonb)
           from (select %s, count(*) as duplicate_count
                   from public.%I
                  where %s
                 group by %s
                 having count(*) > 1) d',
        spec.select_columns,
        spec.table_name,
        spec.filter_expression,
        spec.group_columns
      ) into duplicates;
      raise notice '% duplicates: %', spec.table_name, duplicates;
    end if;
  end loop;
end
$diagnostics$;

-- 10. Realtime publication membership. Every row should be true; otherwise
--     clients can connect to Realtime but will not receive table changes.
with expected(table_name) as (
  values
    ('profiles'), ('events'), ('attendance'), ('match_surveys'),
    ('match_lineup_configs'), ('match_lineup_slots'), ('finances'),
    ('fee_collections'), ('fee_records')
)
select
  e.table_name,
  p.tablename is not null as realtime_enabled
from expected e
left join pg_publication_tables p
  on p.pubname = 'supabase_realtime'
 and p.schemaname = 'public'
 and p.tablename = e.table_name
order by e.table_name;

-- 11. Exact row counts, emitted in SQL Editor's Messages panel.
do $diagnostics$
declare
  table_name text;
  row_count bigint;
begin
  foreach table_name in array array[
    'profiles', 'events', 'attendance', 'match_surveys',
    'match_lineup_configs', 'match_lineup_slots', 'finances',
    'fee_collections', 'fee_records'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice '%: table missing', table_name;
    else
      execute format('select count(*) from public.%I', table_name) into row_count;
      raise notice '%: % rows', table_name, row_count;
    end if;
  end loop;
end
$diagnostics$;

-- Schema-cache repair command (not read-only, so intentionally left commented):
-- notify pgrst, 'reload schema';
