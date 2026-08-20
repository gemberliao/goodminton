-- ============================================================================
-- GOODMINTON secure Auth/RLS write probe (all test rows are rolled back)
-- Prerequisite: one LINKED approved admin and one LINKED approved member.
-- This verifies anon denial, admin CRUD, member ownership, privilege escalation
-- denial, and the activity/payment deadline locks.
-- ============================================================================

begin;

do $requirements$
begin
  if not exists (
    select 1 from public.profiles
    where role = 'admin' and status = 'approved' and auth_user_id is not null
  ) then
    raise exception 'Probe requires a linked approved admin. Complete SUPABASE_AUTH_MIGRATION.md first.';
  end if;
  if not exists (
    select 1 from public.profiles
    where role = 'member' and status = 'approved' and auth_user_id is not null
  ) then
    raise exception 'Probe requires a linked approved member. Complete SUPABASE_AUTH_MIGRATION.md first.';
  end if;
end
$requirements$;

select set_config('goodminton.admin_auth_id', (
  select auth_user_id::text from public.profiles
  where role = 'admin' and status = 'approved' and auth_user_id is not null
  order by created_at limit 1
), true);
select set_config('goodminton.member_auth_id', (
  select auth_user_id::text from public.profiles
  where role = 'member' and status = 'approved' and auth_user_id is not null
  order by created_at limit 1
), true);
select set_config('goodminton.member_profile_id', (
  select id::text from public.profiles
  where role = 'member' and status = 'approved' and auth_user_id is not null
  order by created_at limit 1
), true);
select set_config('goodminton.probe_profile_id', gen_random_uuid()::text, true);
select set_config('goodminton.probe_event_id', gen_random_uuid()::text, true);
select set_config('goodminton.probe_collection_id', gen_random_uuid()::text, true);

-- 1. A public anon key must not be able to read or write application tables.
set local role anon;
do $anon_denial$
begin
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'FAIL: anon unexpectedly has SELECT access to profiles';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.events (id, title, event_date, event_type, location)
    values (gen_random_uuid(), 'ANON MUST FAIL', current_date + 1, '練球', 'Probe');
    raise exception 'FAIL: anon unexpectedly has INSERT access to events';
  exception when insufficient_privilege then
    null;
  end;
end
$anon_denial$;
reset role;

-- 2. An authenticated approved administrator can manage all nine tables.
select set_config('request.jwt.claim.sub', current_setting('goodminton.admin_auth_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into public.profiles (id, username, name, level, role, gender, status)
values (
  current_setting('goodminton.probe_profile_id')::uuid,
  'secure_probe_' || substr(replace(current_setting('goodminton.probe_profile_id'), '-', ''), 1, 10),
  'Secure RLS Probe', '初級', 'member', 'male', 'approved'
);

insert into public.events (id, title, event_date, start_time, end_time, event_type, location)
values (
  current_setting('goodminton.probe_event_id')::uuid,
  'Secure RLS Probe', current_date + 1, time '18:00', time '22:00', '練球', 'Probe Court'
);

insert into public.attendance (id, user_id, event_id, status)
values (
  gen_random_uuid(), current_setting('goodminton.member_profile_id')::uuid,
  current_setting('goodminton.probe_event_id')::uuid, 'pending'
);

insert into public.match_surveys (id, event_id, user_id, preferred_disciplines, max_matches_desired)
values (
  gen_random_uuid(), current_setting('goodminton.probe_event_id')::uuid,
  current_setting('goodminton.member_profile_id')::uuid, array['男雙']::text[], 1
);

insert into public.match_lineup_configs (event_id, is_published, notes)
values (current_setting('goodminton.probe_event_id')::uuid, false, 'probe');

insert into public.match_lineup_slots (id, event_id, point_index, point_name, discipline, player_ids)
values (
  gen_random_uuid(), current_setting('goodminton.probe_event_id')::uuid,
  1, '第 1 點', '男雙', array[current_setting('goodminton.member_profile_id')]::text[]
);

insert into public.finances (id, move_date, title, type, amount, created_by)
values (
  gen_random_uuid(), current_date, 'Secure RLS Probe', 'income', 0,
  current_setting('goodminton.probe_profile_id')::uuid
);

insert into public.fee_collections (id, title, c_type, total_amount, amount_per_person, status, due_date)
values (
  current_setting('goodminton.probe_collection_id')::uuid,
  'Secure RLS Probe', 'fixed', 100, 100, 'active', current_date + 1
);

insert into public.fee_records (id, collection_id, user_id, is_paid, payment_status)
values (
  gen_random_uuid(), current_setting('goodminton.probe_collection_id')::uuid,
  current_setting('goodminton.member_profile_id')::uuid, false, 'unpaid'
);

reset role;

-- 3. A member can update only their own open attendance/survey/payment report.
select set_config('request.jwt.claim.sub', current_setting('goodminton.member_auth_id'), true);
set local role authenticated;

update public.attendance set status = 'attending'
where event_id = current_setting('goodminton.probe_event_id')::uuid
  and user_id = current_setting('goodminton.member_profile_id')::uuid;
update public.match_surveys set notes = 'member update'
where event_id = current_setting('goodminton.probe_event_id')::uuid
  and user_id = current_setting('goodminton.member_profile_id')::uuid;
update public.fee_records set payment_status = 'pending', reported_at = now()
where collection_id = current_setting('goodminton.probe_collection_id')::uuid
  and user_id = current_setting('goodminton.member_profile_id')::uuid;

do $member_escalation_denial$
begin
  begin
    update public.fee_records set is_paid = true, payment_status = 'paid', paid_at = now()
    where collection_id = current_setting('goodminton.probe_collection_id')::uuid
      and user_id = current_setting('goodminton.member_profile_id')::uuid;
    raise exception 'FAIL: member unexpectedly marked their own fee as paid';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.profiles set role = 'admin'
    where id = current_setting('goodminton.member_profile_id')::uuid;
    raise exception 'FAIL: member unexpectedly promoted themselves to admin';
  exception when insufficient_privilege then
    null;
  end;
end
$member_escalation_denial$;
reset role;

-- 4. Admin closes the event/fee dates; later member writes must affect zero rows.
select set_config('request.jwt.claim.sub', current_setting('goodminton.admin_auth_id'), true);
set local role authenticated;
update public.events set event_date = current_date - 1
where id = current_setting('goodminton.probe_event_id')::uuid;
update public.fee_collections set due_date = current_date - 1
where id = current_setting('goodminton.probe_collection_id')::uuid;
reset role;

select set_config('request.jwt.claim.sub', current_setting('goodminton.member_auth_id'), true);
set local role authenticated;
do $deadline_denial$
begin
  update public.attendance set status = 'absent'
  where event_id = current_setting('goodminton.probe_event_id')::uuid
    and user_id = current_setting('goodminton.member_profile_id')::uuid;
  if found then raise exception 'FAIL: member changed attendance after the event ended'; end if;

  update public.fee_records set payment_status = 'unpaid', reported_at = null
  where collection_id = current_setting('goodminton.probe_collection_id')::uuid
    and user_id = current_setting('goodminton.member_profile_id')::uuid;
  if found then raise exception 'FAIL: member changed payment after the due date'; end if;
end
$deadline_denial$;
reset role;

-- 5. Admin cleanup exercises UPDATE/DELETE while every change remains rollback-safe.
select set_config('request.jwt.claim.sub', current_setting('goodminton.admin_auth_id'), true);
set local role authenticated;
update public.profiles set name = 'Secure RLS Probe Updated' where id = current_setting('goodminton.probe_profile_id')::uuid;
update public.events set title = 'Secure RLS Probe Updated' where id = current_setting('goodminton.probe_event_id')::uuid;
update public.attendance set remarks = 'admin update' where event_id = current_setting('goodminton.probe_event_id')::uuid;
update public.match_surveys set notes = 'admin update' where event_id = current_setting('goodminton.probe_event_id')::uuid;
update public.match_lineup_configs set notes = 'admin update' where event_id = current_setting('goodminton.probe_event_id')::uuid;
update public.match_lineup_slots set score = '0-0' where event_id = current_setting('goodminton.probe_event_id')::uuid;
update public.finances set remarks = 'admin update' where title = 'Secure RLS Probe';
update public.fee_collections set title = 'Secure RLS Probe Updated' where id = current_setting('goodminton.probe_collection_id')::uuid;
update public.fee_records set notes = 'admin update' where collection_id = current_setting('goodminton.probe_collection_id')::uuid;

delete from public.match_lineup_slots where event_id = current_setting('goodminton.probe_event_id')::uuid;
delete from public.match_lineup_configs where event_id = current_setting('goodminton.probe_event_id')::uuid;
delete from public.match_surveys where event_id = current_setting('goodminton.probe_event_id')::uuid;
delete from public.fee_records where collection_id = current_setting('goodminton.probe_collection_id')::uuid;
delete from public.fee_collections where id = current_setting('goodminton.probe_collection_id')::uuid;
delete from public.finances where created_by = current_setting('goodminton.probe_profile_id')::uuid;
delete from public.attendance where event_id = current_setting('goodminton.probe_event_id')::uuid;
delete from public.events where id = current_setting('goodminton.probe_event_id')::uuid;
delete from public.profiles where id = current_setting('goodminton.probe_profile_id')::uuid;

select 'PASS: anon denied; admin CRUD passed; member ownership/escalation/deadline rules passed' as result;

reset role;
rollback;
